import {Component} from "../../entity/Component";
import {Entity} from "../../entity/Entity";
import {MeshInstance} from "../../mesh/MeshInstance";
import {MorphAnimation} from "../morph/MorphAnimation";

var nameCounter = 0;

/**
 * LayeredAnimation is a Component that combines a set of AnimationLayer objects into a single manageable animation.
 * The layer animations can act on any object, joint pose or morph pose in the hierarchy of the {@linkcode Entity} to
 * which the Component was assigned. When added to the Scene's root node, it can be seen as a global keyframe animation
 * system for the given scene.
 *
 * @constructor
 *
 * @extends Component
 *
 * @property name The name of the animation.
 * @property timeScale A value to control the playback speed.
 * @property time The current time in milliseconds of the play head.
 * @property looping Determines whether the animation should loop or not. By default, it uses the value determined by
 * the AnimationClip, but can be overridden.
 */
function LayeredAnimation()
{
	Component.call(this);
	this._layers = [];
	this._time = 0;
	this._timeScale = 1;
	this._name = "hx_layeredanimation_" + (nameCounter++);
	this._looping = true;
}

Component.create(LayeredAnimation, {
	name: {
		get: function()
		{
			return this._name;
		},

		set: function(value)
		{
			this._name = value;
		}
	},

	timeScale: {
		get: function()
		{
			return this._timeScale;
		},

		set: function(value)
		{
			this._timeScale = value;
		}
	},

	time: {
		get: function()
		{
			return this._time;
		},

		set: function(value)
		{
			this._time = value;
			for (var i = 0; i < this._layers.length; ++i) {
				this._layers[i].time = value;
			}
		}
	},

	looping: {
		get: function()
		{
			return this._looping;
		},

		set: function(value)
		{
			this._looping = value;
			for (var i = 0; i < this._layers.length; ++i) {
				this._layers[i].looping = true;
			}
		}
	}
});

/**
 * Adds a layer to the animation
 * @param layer
 */
LayeredAnimation.prototype.addLayer = function(layer)
{
	this._layers.push(layer);
	layer.time = this._time;
	layer.looping = this._looping;
};

/**
 * Removes a layer from the animation
 * @param layer
 */
LayeredAnimation.prototype.removeLayer = function(layer)
{
	var index = this._layers.indexOf(layer);
	if (index >= 0)
		this._layers.splice(index, 1);
};

LayeredAnimation.prototype.onAdded = function()
{
	var lookups = this._collectPotentialTargets();

	for (var i = 0, len = this._layers.length; i < len; ++i) {
		this._layers[i].resolveTarget(lookups);
	}
};

LayeredAnimation.prototype.onRemoved = function()
{
	for (var i = 0, len = this._layers.length; i < len; ++i) {
		this._layers[i].resolveTarget(null);
	}
};

LayeredAnimation.prototype.onUpdate = function(dt)
{
	dt *= this._timeScale;

	this._time += dt;

	var len = this._layers.length;
	for (var i = 0; i < len; ++i) {
		this._layers[i].update(dt);
	}
};

LayeredAnimation.prototype.clone = function()
{
	var clone = new LayeredAnimation();
	clone.name = this.name;
	clone.looping = this.looping;
	clone.timeScale = this.timeScale;
	clone.time = this.time;

	for (var i = 0, len = this._layers.length; i < len; ++i) {
		var layer = this._layers[i];
		clone.addLayer(layer.clone());
	}

	return clone;
};

LayeredAnimation.prototype._collectPotentialTargets = function()
{
	var targets = {};
	this._entity.applyFunction(function(node) {
		targets[node._name] = node;

		if (node instanceof Entity) {
			var meshInstances = node.getComponentsByType(MeshInstance);

			for (var i = 0, len = meshInstances.length; i < len; ++i) {
				targets[meshInstances[i].name] = meshInstances[i];
				this._collectPotentialJoints(meshInstances[i], targets);
			}

			var morphAnimations = node.getComponentsByType(MorphAnimation);
			for (i = 0, len = morphAnimations.length; i < len; ++i) {
				targets[morphAnimations[i].name] = morphAnimations[i];
			}
		}
	}, this);

	return targets;
};

/**
 * @private
 * @ignore
 */
LayeredAnimation.prototype._collectPotentialJoints = function(meshInstance, targets)
{
	var skeleton = meshInstance.skeleton;

	if (!skeleton) return;

	for (var i = 0, len = skeleton.numJoints; i < len; ++i) {
		targets[skeleton.getJoint(i).name] = meshInstance.skeletonPose.getJointPose(i);
	}

	return false;
};

export {LayeredAnimation}