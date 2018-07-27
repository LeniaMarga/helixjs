import {Model} from "../mesh/Model";
import {BoundingVolume} from "../scene/BoundingVolume";
import {Float4} from "../math/Float4";
import {ModelInstance} from "../mesh/ModelInstance";
import {RenderCollector} from "../render/RenderCollector";
import {Mesh} from "../mesh/Mesh";
import {Entity} from "../entity/Entity";
import {SceneNode} from "./SceneNode";

/**
 * Terrain provides a paged terrain engine with dynamic LOD. The heightmapping itself happens in the Material.
 *
 * @property {number} terrainSize The world size for the entire terrain.
 *
 * @param terrainSize The world size for the entire terrain's geometry. Generally smaller than the total world size of the height map.
 * @param minElevation The minimum elevation for the terrain (maps to heightmap value 0)
 * @param maxElevation The maximum elevation for the terrain (maps to heightmap value 1)
 * @param numLevels The amount of levels the page tree should contain. More levels means more(!) triangles.
 * @param material The {@linkcode Material} to use when rendering the terrain.
 * @param detail The grid size.
 * @constructor
 *
 * @extends SceneNode
 *
 * @author derschmale <http://www.derschmale.com>
 */
function Terrain(terrainSize, minElevation, maxElevation, numLevels, material, detail)
{
    Entity.call(this);

    this._terrainSize = terrainSize || 512;
    this._minElevation = minElevation;
    this._maxElevation = maxElevation;
    this._numLevels = numLevels || 4;
    // this container will move along with the "player"
    // we use the extra container so the Terrain.position remains constant, so we can reliably translate and use rigid body components
    this._container = new SceneNode();
    this._container._parent = this;
    detail = detail || 32;
    var gridSize = Math.ceil(detail * .5) * 2.0; // round off to 2

    // cannot bitshift because we need floating point result
    this._snapSize = (this._terrainSize / detail) / Math.pow(2, this._numLevels);

    this._material = material;
    material.setUniform("hx_elevationOffset", minElevation);
    material.setUniform("hx_elevationScale", maxElevation - minElevation);

    this._initModels(gridSize);
    this._initTree();
}

// TODO: Allow setting material
Terrain.prototype = Object.create(Entity.prototype, {
    terrainSize: {
        get: function() {
            return this._terrainSize;
        }
    }
});

/**
 * @ignore
 * @private
 */
Terrain.prototype._createModel = function(size, numSegments, subDiv, lastLevel)
{
    var rcpNumSegments = 1.0 / numSegments;
    var mesh = new Mesh();
    var cellSize = size * rcpNumSegments;
    var halfCellSize = cellSize * .5;

    mesh.addVertexAttribute("hx_position", 3);
    mesh.addVertexAttribute("hx_normal", 3);
    mesh.addVertexAttribute("hx_cellSize", 1);

    var vertices = [];
    var indices = [];

    var numZ = subDiv? numSegments - 1: numSegments;

    var w = numSegments + 1;

    for (var yi = 0; yi <= numZ; ++yi) {
        var y = (yi*rcpNumSegments - .5) * size;

        for (var xi = 0; xi <= numSegments; ++xi) {
            var x = (xi*rcpNumSegments - .5) * size;

            // the one corner that attaches to higher resolution neighbours needs to snap like them
            var s = !lastLevel && xi === numSegments && yi === numSegments? halfCellSize : cellSize;
            vertices.push(x, y, 0, 0, 0, 1, s);

            if (xi !== numSegments && yi !== numZ) {
                var base = xi + yi * w;

                indices.push(base, base + w + 1, base + w);
                indices.push(base, base + 1, base + w + 1);
            }
        }
    }

    var highIndexX = vertices.length / 7;

    if (subDiv) {
        y = (numSegments * rcpNumSegments - .5) * size;
        for (xi = 0; xi <= numSegments; ++xi) {
            x = (xi*rcpNumSegments - .5) * size;
            vertices.push(x, y, 0, 0, 0, 1);
            vertices.push(halfCellSize);

            if (xi !== numSegments) {
                base = xi + numZ * w;
                vertices.push(x + halfCellSize, y, 0, 0, 0, 1, halfCellSize);
                indices.push(base, highIndexX + xi * 2 + 1, highIndexX + xi * 2);
                indices.push(base + 1, highIndexX + xi * 2 + 1, base);
                indices.push(highIndexX + xi * 2 + 2, highIndexX + xi * 2 + 1, base + 1);
            }
        }
    }

    mesh.setVertexData(vertices, 0);
    mesh.setIndexData(indices);

    var model = new Model(mesh);
    model.localBounds.growToIncludeMinMax(new Float4(0, 0, this._minElevation), new Float4(0, 0, this._maxElevation));
    return model;
};

/**
 * @ignore
 * @private
 */
Terrain.prototype._initModels = function(gridSize)
{
    this._models = [];
    var modelSize = this._terrainSize * .25;

    for (var level = 0; level < this._numLevels; ++level) {
        if (level === this._numLevels - 1) {
            // do not subdivide max detail
            var model = this._createModel(modelSize, gridSize, false, true);
            this._models[level] = {
                edge: model,
                corner: model
            };
        }
        else {
            this._models[level] = {
                edge: this._createModel(modelSize, gridSize, true, false),
                corner: this._createModel(modelSize, gridSize, false, false)
            };
        }

        modelSize *= .5;

    }
};

/**
 * @ignore
 * @private
 */
Terrain.prototype._initTree = function()
{
    var level = 0;
    var size = this._terrainSize * .25;
    for (var yi = 0; yi < 4; ++yi) {
        var y = this._terrainSize * (yi / 4 - .5) + size * .5;
        for (var xi = 0; xi < 4; ++xi) {
            var x = this._terrainSize * (xi / 4 - .5) + size * .5;
            var subX = 0, subY = 0;

            if (xi === 1)
                subX = 1;
            else if (xi === 2)
                subX = -1;

            if (yi === 1)
                subY = 1;
            else if (yi === 2)
                subY = -1;

            if (subX && subY) {
                this._subDivide(x, y, subX, subY, level + 1, size * .5);
            }
            else {
                var rotation = 0;
                var mode = "edge";
                var add = true;
                // if both are 0, we have a corner
                if (xi % 3 === yi % 3) {
                    mode = "corner";
                    if (xi === 0 && yi === 0) rotation = 0;
                    if (xi === 0 && yi === 3) rotation = 1;
                    if (xi === 3 && yi === 3) rotation = 2;
                    if (xi === 3 && yi === 0) rotation = -1;
                }
                else {
                    if (yi === 3) rotation = 2;
                    if (xi === 3) rotation = -1;
                    if (xi === 0) rotation = 1;
                }
                if (add)
                    this._addModel(x, y, level, rotation, mode);
            }
        }
    }
};

/**
 * @ignore
 * @private
 */
Terrain.prototype._addModel = function(x, y, level, rotation, mode)
{
    var modelInstance = new ModelInstance(this._models[level][mode], this._material);
    modelInstance.position.set(x, y, 0);
    // this rotation aligns the higher triangle strips
    modelInstance.rotation.fromAxisAngle(Float4.Z_AXIS, -rotation * Math.PI * .5);
    this._container.attach(modelInstance);
};

/**
 * @ignore
 * @private
 */
Terrain.prototype._subDivide = function(x, y, subX, subY, level, size)
{
    size *= .5;

    for (var yi = -1; yi <= 1; yi += 2) {
        for (var xi = -1; xi <= 1; xi += 2) {
            if((xi !== subX || yi !== subY) || level === this._numLevels - 1) {
                var rotation = 0;
                var mode = "corner";
                // messy, I know
                if (x < 0 && y < 0) {
                    if (xi < 0 && yi > 0) {
                        mode = "edge";
                        rotation = 1;
                    }
                    else if (xi > 0 && yi < 0) {
                        mode = "edge";
                        rotation = 0;
                    }
                    else
                        rotation = 0;
                }
                else if (x > 0 && y > 0) {
                    if (xi > 0 && yi < 0) {
                        mode = "edge";
                        rotation = -1;
                    }
                    else if (xi < 0 && yi > 0) {
                        mode = "edge";
                        rotation = 2;
                    }
                    else
                        rotation = 2;
                }
                else if (x < 0 && y > 0) {
                    if (xi > 0 && yi > 0) {
                        mode = "edge";
                        rotation = 2;
                    }
                    else if (xi < 0 && yi < 0) {
                        mode = "edge";
                        rotation = 1;
                    }
                    else
                        rotation = 1;
                }
                else if (x > 0 && y < 0) {
                    if (xi < 0 && yi < 0) {
                        mode = "edge";
                        rotation = 0;
                    }
                    else if (xi > 0 && yi > 0) {
                        mode = "edge";
                        rotation = -1;
                    }
                    else
                        rotation = -1;
                }

                this._addModel(x + size * xi, y + size * yi, level, rotation, mode);
            }
        }
    }

    if (level < this._numLevels - 1)
        this._subDivide(x + size * subX, y + size * subY, subX, subY, level + 1, size);
};

/**
 * @ignore
 */
Terrain.prototype.acceptVisitor = function(visitor)
{
    // typechecking isn't nice, but it does what we want
    if (visitor instanceof RenderCollector) {
        var pos = visitor._camera.position;
        this._container.position.x = Math.floor(pos.x / this._snapSize) * this._snapSize - this.position.x;
        this._container.position.y = Math.floor(pos.y / this._snapSize) * this._snapSize - this.position.y;
    }

    Entity.prototype.acceptVisitor.call(this, visitor);
    this._container.acceptVisitor(visitor);
};

/**
 * @ignore
 */
Terrain.prototype._updateWorldBounds = function ()
{
    this._worldBounds.clear(BoundingVolume.EXPANSE_INFINITE);
};

Terrain.prototype._invalidateWorldMatrix = function ()
{
    Entity.prototype._invalidateWorldMatrix.call(this);
    this._container._invalidateWorldMatrix();
};

Terrain.prototype._setScene = function(scene)
{
	Entity.prototype._setScene.call(this, scene);
	this._container._setScene(scene);
};

export { Terrain };