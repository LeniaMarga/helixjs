import {Component} from "../entity/Component";

/**
 * @classdesc
 * Effect is a {@linkcode Component} that will be picked up by the renderer for post-processing. Most effects are added
 * to the Camera, but some could be tied to a different Entity (for example: a DirectionalLight for crepuscular rays)
 *
 * @property {boolean} needsNormalDepth Defines whether this Effect needs normal/depth information from the renderer.
 * @property {FrameBuffer} hdrTarget The current full-resolution render target.
 * @property {Texture2D} hdrSource The current full-resolution source texture.
 *
 * @constructor
 *
 * @extends Component
 *
 * @author derschmale <http://www.derschmale.com>
 */
function Effect()
{
    Component.call(this);
	this.needsNormalDepth = false;
	this.outputsGamma = false;
	this._mesh = null;
}

Effect.prototype = Object.create(Component.prototype,
    {
        hdrTarget: {
            get: function() { return this._renderer._hdrFront.fbo; }
        },

        hdrSource: {
            get: function() { return this._renderer._hdrBack.texture; }
        }
    }
);

/**
 * Indicates whether this Effect is supported considering the current capabilities. Subclasses should overwrite this
 * if support depends on extensions.
 */
Effect.prototype.isSupported = function()
{
	return true;
};

/**
 * @ignore
 */
Effect.prototype.render = function(renderer, dt)
{
    this._renderer = renderer;
    this.draw(renderer, dt);
};

/**
 * This method needs to be implemented by child classes.
 */
Effect.prototype.draw = function(dt)
{
    throw new Error("Abstract method error!");
};


/**
 * @ignore
 */
Effect.prototype.onAdded = function()
{
};

/**
 * @ignore
 */
Effect.prototype.onRemoved = function()
{
};

/**
 * Child classes need to call this when rendering to and from full-resolution textures. This will effectively swap hdrSource and hdrTarget to allow ping-ponging.
 */
Effect.prototype._swapHDRFrontAndBack = function()
{
    this._renderer._swapHDRFrontAndBack();
};

Component.register("effect", Effect);

export { Effect };