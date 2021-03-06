import {ShaderLibrary} from "../shader/ShaderLibrary";
import {EffectPass} from "./EffectPass";
import {CenteredGaussianCurve} from "../math/CenteredGaussianCurve";

/**
 * @classdesc
 * GaussianBlurPass is an {@linkcode EffectPass} that performs a separable gaussian blur pass (ie: in one direction).
 *
 * @constructor
 * @param radius The radius of the blur.
 *
 * @extends EffectPass
 *
 * @author derschmale <http://www.derschmale.com>
 */
function GaussianBlurPass(radius)
{
    radius = Math.floor(radius);

    this._initWeights(radius);

    var defines = {
        RADIUS: radius,
        NUM_WEIGHTS: radius + 1
    };

    var vertex = ShaderLibrary.get("gaussian_blur_vertex.glsl", defines);
    var fragment = ShaderLibrary.get("gaussian_blur_fragment.glsl", defines);

    EffectPass.call(this, vertex, fragment);

    this.setUniformArray("gaussianWeights", new Float32Array(this._weights));
}

GaussianBlurPass.prototype = Object.create(EffectPass.prototype);

/**
 * @ignore
 */
GaussianBlurPass.prototype._initWeights = function(radius)
{
    this._weights = [];

    var gaussian = CenteredGaussianCurve.fromRadius(radius, .01);

    var total = 0;
    for (var j = 0; j <= radius; ++j) {
        this._weights[j] = gaussian.evaluate(j);
        total += j > 0? this._weights[j] * 2.0 : 1.0;
    }

    total = 1.0 / total;

    for (j = 0; j <= radius; ++j) {
        this._weights[j] *= total;
    }
};

export { GaussianBlurPass };