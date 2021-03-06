import {EntitySystem} from "../entity/EntitySystem";
import {PointLight} from "./PointLight";
import {LightProbe} from "./LightProbe";
import {SpotLight} from "./SpotLight";
import {DirectionalLight} from "./DirectionalLight";
import {MeshInstance} from "../mesh/MeshInstance";
import {AsyncTaskQueue} from "../utils/AsyncTaskQueue";

/**
 * @classdesc
 *
 * FixedLightsSystem is System that automatically assigns all lights in a scene to all materials in the scene. This
 * system assumes each Entity only has one light component assigned to each.
 *
 * @constructor
 *
 * @author derschmale <http://www.derschmale.com>
 */
function FixedLightsSystem()
{
	EntitySystem.call(this);
	this._onLightAddedFuncs = {};
	this._onLightRemovedFuncs = {};
	this._queue = null;
}

FixedLightsSystem.prototype = Object.create(EntitySystem.prototype);

/**
 * @ignore
 */
FixedLightsSystem.prototype.onStarted = function()
{
	this._lights = [];
	this._meshSet = this.getEntitySet([MeshInstance]);
	this._meshSet.onEntityAdded.bind(this._onMeshInstanceAdded, this);
	this._pointSet = this._initSet(PointLight, "light");
	this._spotSet = this._initSet(SpotLight, "light");
	this._dirSet = this._initSet(DirectionalLight, "light");
	this._probeSet = this._initSet(LightProbe, "lightProbe");
	this._assignLights();
};

/**
 * @ignore
 * @private
 */
FixedLightsSystem.prototype.onStopped = function()
{
	this._meshSet.onEntityAdded.unbind(this._onMeshInstanceAdded);
	this._destroySet(this._pointSet, PointLight);
	this._destroySet(this._spotSet, SpotLight);
	this._destroySet(this._dirSet, DirectionalLight);
	this._destroySet(this._probeSet, LightProbe);
	this._meshSet.free();
};

/**
 * @ignore
 * @private
 */
FixedLightsSystem.prototype._initSet = function(type, componentName)
{
	var set = this.getEntitySet([type]);
	this._onLightAddedFuncs[type] = this._onLightAdded.bind(this, componentName);
	this._onLightRemovedFuncs[type] = this._onLightRemoved.bind(this, componentName);
	set.onEntityAdded.bind(this._onLightAddedFuncs[type]);
	set.onEntityRemoved.bind(this._onLightRemovedFuncs[type]);
	addLights(this._lights, set, componentName);
	return set;
};

/**
 * @ignore
 * @private
 */
FixedLightsSystem.prototype._destroySet = function(set, type)
{
	set.onEntityAdded.unbind(this._onLightAddedFuncs[type]);
	set.onEntityRemoved.unbind(this._onLightRemovedFuncs[type]);
	set.free();
};


/**
 * @ignore
 */
FixedLightsSystem.prototype._onLightAdded = function(compName, entity)
{
	var light = entity.components[compName][0];
	this._lights.push(light);
	this._assignLights();
};

FixedLightsSystem.prototype._onLightRemoved = function(lightName, entity)
{
	var light = entity.components[lightName][0];
	var index = this._lights.indexOf(light);
	this._lights.splice(index, 1);
	this._assignLights();
};

/**
 * @ignore
 * @private
 */
FixedLightsSystem.prototype._onMeshInstanceAdded = function(entity)
{
	this._queueOrAssign(entity, this._lights);
};

/**
 * @ignore
 * @private
 */
FixedLightsSystem.prototype._assignLights = function()
{
	// all lights need to be re-assigned, cancel this
	if (this._queue)
		this._queue.cancel();

	// this will invalidate all materials, so do things one at a time
	for (var i = 0, len = this._meshSet.numEntities; i < len; ++i)
		this._queueOrAssign(this._meshSet.getEntity(i));
};

/**
 * @ignore
 * @material
 */
FixedLightsSystem.prototype._queueOrAssign = function(entity)
{
	if (!this._queue || !this._queue.isRunning)
		this._queue = new AsyncTaskQueue();

	// if material isn't initialized, it's okay to assign lights directly, since the material will be compiled on render
	// anyway
	var meshInstance = entity.components.meshInstance[0];
	var material = meshInstance.material;
	if (material._initialized)
		this._queue.queue(assignLights, material, this._lights);
	else
		assignLights(material, this._lights);

	if (!this._queue.isRunning)
		this._queue.execute();
};

function assignLights(material, lights)
{
	material.fixedLights = lights;
	material.init();
}

function addLights(lights, set, compName)
{
	for (var i = 0, len = set.numEntities; i < len; ++i) {
		var light = set.getEntity(i).components[compName][0];
		lights.push(light);
	}
}

export { FixedLightsSystem };