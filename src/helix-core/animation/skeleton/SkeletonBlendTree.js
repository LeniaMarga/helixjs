/**
 * @classdesc
 * A SkeletonBlendTree is used by {@linkcode SkeletonAnimation} internally to blend complex animation setups. Using this,
 * we can crossfade between animation clips (such as walking/running) while additionally having extra modifiers applied,
 * such as gun aiming, head turning, etc.
 *
 * @constructor
 * @param {SkeletonBlendNode} rootNode The root node of the tree.
 * @param {Skeleton} skeleton The skeleton to animate.
 *
 * @author derschmale <http://www.derschmale.com>
 */
function SkeletonBlendTree(rootNode, skeleton)
{
	this.skeleton = skeleton;
	this.transferRootJoint = false;
	this.rootNode = rootNode;
}

SkeletonBlendTree.prototype =
{
    get skeletonPose() { return this._rootNode.pose; },

    get rootJointDeltaPosition() { return this._rootNode.rootJointDeltaPosition; },

    update: function(dt)
    {
        var updated = this.rootNode.update(dt, this.transferRootJoint);
        if (updated)
            this.rootNode.pose.invalidateGlobalPose();

        return updated;
    },

    /**
     * Gets a node in the tree with the given name.
     */
    getNode: function(name)
    {
        return this.rootNode.findNode(name);
    }
};


export { SkeletonBlendTree };