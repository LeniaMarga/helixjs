import {GLSLIncludes} from './GLSLIncludes';
import {GL} from '../core/GL';
import {META} from '../Helix';
import {UniformSetter} from "./UniformSetter";
import {Debug} from "../debug/Debug";
import {TextureSlot} from "../material/TextureSlot";


/**
 * @ignore
 * @param vertexShaderCode
 * @param fragmentShaderCode
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function Shader(vertexShaderCode, fragmentShaderCode)
{
	this.program = null;
	this._uniforms = null;
	this._textureUniforms = null;
	this._ready = false;
	this._vertexShader = null;
	this._fragmentShader = null;
	this._uniformSettersInstance = null;
	this._uniformSettersPass = null;

	if (vertexShaderCode && fragmentShaderCode)
		this.init(vertexShaderCode, fragmentShaderCode);
}

Shader.ID_COUNTER = 0;

Shader.prototype = {
	constructor: Shader,

	isReady: function()
	{
		return this._ready;
	},

	init: function(vertexShaderCode, fragmentShaderCode)
	{
		var gl = GL.gl;
		vertexShaderCode = "#define HX_VERTEX_SHADER\n" + GLSLIncludes.GENERAL + vertexShaderCode;
		fragmentShaderCode = "#define HX_FRAGMENT_SHADER\n" + GLSLIncludes.GENERAL + fragmentShaderCode;

		this._vertexShader = getShader(vertexShaderCode, gl.VERTEX_SHADER);
		this._fragmentShader = getShader(fragmentShaderCode, gl.FRAGMENT_SHADER);

		if (!this._vertexShader || !this._fragmentShader) {
			this.dispose();
			return;
		}

		this.program = gl.createProgram();

		gl.attachShader(this.program, this._vertexShader);
		gl.attachShader(this.program, this._fragmentShader);
		gl.linkProgram(this.program);

		if (META.OPTIONS.debug && !gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
			var log = gl.getProgramInfoLog(this.program);
			this.dispose();

			console.log("**********");
			Debug.printShaderCode(vertexShaderCode);
			console.log("**********");
			Debug.printShaderCode(fragmentShaderCode);

			if (META.OPTIONS.throwOnShaderError)
				throw new Error("Error in program linking:" + log);

			console.warn("Error in program linking:" + log);

			return;
		}

		this._ready = true;

		// Profiler.stopTiming("Shader::init");

		this._uniformSettersInstance = UniformSetter.getSettersPerInstance(this);
		this._uniformSettersPass = UniformSetter.getSettersPerPass(this);

		this._storeUniforms();
	},

	updatePassRenderState: function(camera, renderer)
	{
		GL.gl.useProgram(this.program);

		var len = this._uniformSettersPass.length;
		for (var i = 0; i < len; ++i)
			this._uniformSettersPass[i].execute(camera, renderer);
	},

	updateInstanceRenderState: function(camera, renderItem)
	{
		var len = this._uniformSettersInstance.length;
		for (var i = 0; i < len; ++i)
			this._uniformSettersInstance[i].execute(camera, renderItem);
	},

	dispose: function()
	{
		var gl = GL.gl;
		if (this._vertexShader) gl.deleteShader(this._vertexShader);
		if (this._fragmentShader) gl.deleteShader(this._fragmentShader);
		if (this.program) gl.deleteProgram(this.program);

		this._ready = false;
	},

	hasUniform: function(name)
	{
		return this._uniforms.hasOwnProperty(name);
	},

	getUniform: function(name)
	{
		return this._uniforms[name];
	},

	getUniformLocation: function(name)
	{
		if (this.hasUniform(name))
			return this._uniforms[name].location;

		return null;
	},

	getAttributeLocation: function(name)
	{
		return GL.gl.getAttribLocation(this.program, name);
	},

	_storeUniforms: function()
	{
		this._uniforms = {};
		this._textureUniforms = [];
		var textureCount = 0;

		var gl = GL.gl;

		gl.useProgram(this.program);

		var len = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);

		for (var i = 0; i < len; ++i) {
			var uniform = gl.getActiveUniform(this.program, i);
			var name = uniform.name;
			var location = gl.getUniformLocation(this.program, name);
			this._uniforms[name] = {type: uniform.type, location: location, size: uniform.size};

			if (uniform.type === gl.SAMPLER_2D || uniform.type === gl.SAMPLER_CUBE) {
				// this should also take care of texture arrays, right?
				this._textureUniforms.push(uniform);
				gl.uniform1i(location, textureCount++);
			}
		}
	},

	createTextureSlots: function()
	{
		var slots = [];
		for (var i = 0, len = this._textureUniforms.length; i < len; ++i) {
			var slot = new TextureSlot();
			var uniform = this._textureUniforms[i];
			slot.name = uniform.name;
			slot.index = i;
			slot.location = uniform.location;
			slots[i] = slot;
		}
		return slots;
	}
};


function processExtensions(code, regEx, extension)
{
	var index = code.search(regEx);
	if (index < 0) return code;
	code = "#extension " + extension + " : enable\n" + code.replace(regEx, "");
	return code;
}

// this makes sure reserved uniforms are only used once, makes it easier to combine several snippets
// it's quite slow, tho
function guard(code, regEx)
{
	var result = code.match(regEx) || [];
	var covered = {};

	for (var i = 0; i < result.length; ++i) {
		var occ = result[i];
		occ = occ.replace(/(\r|\n)/g, "");

		if (occ.charCodeAt(0) === 10)
			occ = occ.substring(1);

		var start = occ.indexOf("hx_");
		var end = occ.indexOf(";");

		// in case of arrays
		var sq = occ.indexOf("[");
		if (sq >= 0 && sq < end) end = sq;

		var name = occ.substring(start, end);
		name = name.trim();

		if (covered[name]) continue;

		covered[name] = true;

		var defName = "HX_GUARD_" + name.toUpperCase();
		var repl = "\n#ifndef " + defName + "\n" +
			"#define " + defName + "\n" +
			occ + "\n" +
			"#endif\n";

		occ = occ.replace(/\[/g, "\\[");
		var replReg = new RegExp(occ, "g");
		code = code.replace(replReg, repl);
	}

	return code;
}

function initShader(shader, code)
{
	var gl = GL.gl;
	gl.shaderSource(shader, code);
	gl.compileShader(shader);

	// Check the compile status, return an error if failed
	if (META.OPTIONS.debug && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.warn(gl.getShaderInfoLog(shader));
		Debug.printShaderCode(code);
		return false;
	}

	return true;
}

function getShader(code, type)
{
	// is there a way to safely cache this so we don't have to do it over an over?
	code = processShaderCode(code);

	var shader = GL.gl.createShader(type);
	if (!initShader(shader, code)) {
		this.dispose();
		if (META.OPTIONS.throwOnShaderError) {
			throw new Error("Failed generating shader: \n" + code);
		}
		else {
			console.warn("Failed generating shader");
		}

		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function processShaderCode(code)
{
	code = processExtensions(code, /^\s*#derivatives\s*$/gm, "GL_OES_standard_derivatives");
	code = processExtensions(code, /^\s*#texturelod\s*$/gm, "GL_EXT_shader_texture_lod");
	code = processExtensions(code, /^\s*#drawbuffers\s*$/gm, "GL_EXT_draw_buffers");
	code = guard(code, /^\s*uniform\s+\w+\s+hx_\w+(\[\w+])?\s*;/gm);
	code = guard(code, /^\s*attribute\s+\w+\s+hx_\w+\s*;/gm);
	code = GLSLIncludes.VERSION + code;
	return code;
}

export {Shader};