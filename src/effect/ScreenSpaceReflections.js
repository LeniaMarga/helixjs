/**
 *
 * @param numSamples
 * @param range
 * @constructor
 */
HX.ScreenSpaceReflections = function(numSamples)
{
    HX.Effect.call(this);
    numSamples = numSamples || 5;
    this._numSamples = numSamples;

    var defines = {
        NUM_SAMPLES: numSamples
    };

    var vertexShader = HX.ShaderLibrary.get("ssr_vertex.glsl", defines);
    var fragmentShader = HX.ShaderLibrary.get("ssr_fragment.glsl", defines);

    this._pass = new HX.EffectPass(vertexShader, fragmentShader);
    this._sourceTextureSlot = this._pass.getTextureSlot("source");
    this._scale = .5;
    this.stepSize = Math.max(500.0 / numSamples, 1.0);
    this.maxDistance = 500.0;

    this._ssrTexture = new HX.Texture2D();
    this._ssrTexture.setFilter(HX.TextureFilter.BILINEAR_NOMIP);
    this._ssrTexture.setWrapMode(HX.TextureWrapMode.CLAMP);
    this._fbo = new HX.FrameBuffer(this._ssrTexture);
};

HX.ScreenSpaceReflections.prototype = Object.create(HX.Effect.prototype);


/**
 * Amount of pixels to skip per sample
 */
Object.defineProperties(HX.ScreenSpaceReflections.prototype, {
    stepSize: {
        get: function () {
            return this._stepSize;
        },

        set: function (value) {
            this._stepSize = value;
            this._pass.setUniform("stepSize", value);
        }
    },

    maxDistance: {
        get: function()
        {
            return this._stepSize;
        },

        set: function(value)
        {
            this._stepSize = value;
            this._pass.setUniform("maxDistance", value);
        }
    },

    scale: {
        get: function()
        {
            return this._scale;
        },

        set: function(value)
        {
            this._scale = value;
            if (this._scale > 1.0) this._scale = 1.0;
        }
    },

    sourceTexture: {
        get: function()
        {
            return this._sourceTextureSlot.texture;
        },

        set: function(value)
        {
            this._sourceTextureSlot.texture = value;
        }
    }
});

// every SSAO type should implement this
HX.ScreenSpaceReflections.prototype.getSSRTexture = function()
{
    return this._ssrTexture;
};

HX.ScreenSpaceReflections.prototype.draw = function(dt)
{
    var w = this._hdrTarget.width * this._scale;
    var h = this._hdrTarget.height * this._scale;
    if (HX.TextureUtils.assureSize(w, h, this._ssrTexture, this._fbo)) {
        this._pass.setUniform("ditherTextureScale", {x: w / HX.DEFAULT_2D_DITHER_TEXTURE.width, y: h / HX.DEFAULT_2D_DITHER_TEXTURE.height});
    }

    HX.setRenderTarget(this._fbo);
    HX.GL.viewport(0, 0, w, h);
    this._drawPass(this._pass);
    HX.GL.viewport(0, 0, this._hdrTarget.width, this._hdrTarget.height);
};