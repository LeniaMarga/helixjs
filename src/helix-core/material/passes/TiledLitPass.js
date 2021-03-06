import {MaterialPass} from "../MaterialPass";
import {ShaderLibrary} from "../../shader/ShaderLibrary";
import {capabilities, META} from "../../Helix";
import {Shader} from "../../shader/Shader";
import {ShaderUtils} from "../../utils/ShaderUtils";


/**
 * @classdesc
 * This material pass renders all lighting in one fragment shader.
 *
 * @ignore
 *
 * @param geometryVertex
 * @param geometryFragment
 * @param lightingModel
 * @param lights
 * @constructor
 */
function TiledLitPass(geometryVertex, geometryFragment, lightingModel, defines)
{
    MaterialPass.call(this, this._generateShader(geometryVertex, geometryFragment, lightingModel, defines));
}

TiledLitPass.prototype = Object.create(MaterialPass.prototype);

TiledLitPass.prototype._generateShader = function (geometryVertex, geometryFragment, lightingModel, defines)
{
    var extensions = "#derivatives\n";
    var lightDefines = {
		HX_NUM_DIR_LIGHTS: META.OPTIONS.maxDirLights,
		HX_NUM_POINT_SPOT_LIGHTS: META.OPTIONS.maxPointSpotLights,
		HX_NUM_DIFFUSE_PROBES: META.OPTIONS.maxDiffuseProbes,
		HX_NUM_SPECULAR_PROBES: META.OPTIONS.maxSpecularProbes,
		HX_CELL_STRIDE: META.OPTIONS.maxPointSpotLights + 1,
		HX_NUM_CELLS_X: META.OPTIONS.numLightingCellsX,
		HX_NUM_CELLS_Y: META.OPTIONS.numLightingCellsY,
		HX_CELL_ARRAY_LEN: Math.ceil(META.OPTIONS.numLightingCellsX * META.OPTIONS.numLightingCellsY * (META.OPTIONS.maxPointSpotLights + 1) / 4)
	};

	defines = ShaderUtils.processDefines(defines) + ShaderUtils.processDefines(lightDefines);

    if (capabilities.EXT_SHADER_TEXTURE_LOD) {
        extensions += "#texturelod\n";
    }

    var vertexShader = defines + geometryVertex + "\n" + ShaderLibrary.get("material_fwd_tiled_vertex.glsl");

    var fragmentShader =
        extensions + defines +
        ShaderLibrary.get("snippets_geometry.glsl") + "\n" +
        lightingModel + "\n\n\n" +
        META.OPTIONS.shadowFilter.getGLSL() + "\n" +
        ShaderLibrary.get("directional_light.glsl") + "\n" +
        ShaderLibrary.get("point_light.glsl") + "\n" +
        ShaderLibrary.get("spot_light.glsl") + "\n" +
        ShaderLibrary.get("light_probe.glsl") + "\n" +
        geometryFragment + "\n" +
        ShaderLibrary.get("material_fwd_tiled_fragment.glsl");

    return new Shader(vertexShader, fragmentShader);
};

export {TiledLitPass};