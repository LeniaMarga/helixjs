/**
 * @classdesc
 *
 * TrackedController is a Component that allows entities to track a gamepad's orientation, usually used for VR controllers.
 *
 * @param gamepad The gamepad
 * @constructor
 */
function TrackedController(gamepad)
{
    HX.Component.call(this);
    this._gamepad = gamepad;
}

TrackedController.prototype = Object.create(HX.Component.prototype);

TrackedController.prototype.onAdded = function()
{
    this._rigidBody = this.entity.components.rigidBody[0];
    if (this._rigidBody) {
        this._originalKinematic = this._rigidBody.isKinematic;
        this._rigidBody.isKinematic = true;
    }
};

TrackedController.prototype.onRemoved = function()
{
    if (this._rigidBody)
        this._rigidBody.isKinematic = this._originalKinematic;
};

TrackedController.prototype.onUpdate = function(dt)
{
    var entity = this.entity;
    var gamepad = this._gamepad;

    if (!(gamepad.hasPosition && gamepad.hasRotation)) {
        entity.visible = false;
        return;
    }

    entity.visible = true;
    entity.position = gamepad.position;
    entity.rotation = gamepad.rotation;

    // do we need to explicitly set this?
    if (this._rigidBody) {
        if (gamepad.linearVelocity)
            this._rigidBody.linearVelocity = gamepad.linearVelocity;

        if (gamepad.angularVelocity)
            this._rigidBody.angularVelocity = gamepad.angularVelocity;
    }
};

HX.Component.register("trackedController", TrackedController);