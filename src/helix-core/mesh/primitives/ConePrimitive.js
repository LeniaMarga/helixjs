import {Primitive} from "./Primitive";

/**
 * @classdesc
 * ConePrimitive provides a primitive cone {@linkcode Model}.
 *
 * @constructor
 * @param definition An object containing the following (optional) parameters:
 * <ul>
 *     <li>numSegmentsW: The amount of horizontal segments</li>
 *     <li>numSegmentsH: The amount of vertical segments </li>
 *     <li>radius: The radius of the cone base</li>
 *     <li>height: The height of the cone</li>
 *     <li>doubleSided: Whether or not the faces should point both ways</li>
 * </ul>
 *
 * @extends Primitive
 *
 * @author derschmale <http://www.derschmale.com>
 */
function ConePrimitive(definition)
{
    Primitive.call(this, definition);
}

ConePrimitive.prototype = Object.create(Primitive.prototype);

/**
 * The alignment dictates which access should be parallel to the sides of the cone
 * @type {number}
 */
ConePrimitive.ALIGN_X = 1;
ConePrimitive.ALIGN_Y = 2;
ConePrimitive.ALIGN_Z = 3;

ConePrimitive.prototype._generate = function(target, definition)
{
    definition = definition || {};
    var alignment = definition.alignment || ConePrimitive.ALIGN_Z;
    var numSegmentsH = definition.numSegmentsH || 1;
    var numSegmentsW = definition.numSegmentsW || 16;
    var radius = definition.radius || .5;
    var height = definition.height || 1;
    var doubleSided = definition.doubleSided === undefined? false : definition.doubleSided;

    var positions = target.positions;
    var uvs = target.uvs;
    var normals = target.normals;
    var indices = target.indices;
    var hi, ci;
    var cx, cy;
    var angle;

    var rcpNumSegmentsW = 1/numSegmentsW;
    var rcpNumSegmentsH = 1/numSegmentsH;

    // sides
    for (hi = 0; hi <= numSegmentsH; ++hi) {
        var rad = (1.0 - hi * rcpNumSegmentsH) * radius;
        var h = (hi*rcpNumSegmentsH - .5)*height;
        for (ci = 0; ci <= numSegmentsW; ++ci) {
            angle = ci * rcpNumSegmentsW * Math.PI * 2;
            var nx = Math.sin(angle);
            var ny = Math.cos(angle);
            cx = nx * rad;
            cy = ny * rad;

            switch (alignment) {
                case ConePrimitive.ALIGN_X:
                    positions.push(h, cy, cx);
                    if (normals) normals.push(0, ny, nx);
                    break;
                case ConePrimitive.ALIGN_Z:
                    positions.push(cx, -cy, h);
                    if (normals) normals.push(nx, -ny, 0);
                    break;
                default:
                    // Y
                    positions.push(cx, h, cy);
                    if (normals) normals.push(nx, 0, ny);
                    break;
            }

            if (uvs) uvs.push(1.0 - ci*rcpNumSegmentsW, 1.0 - hi*rcpNumSegmentsH);
        }
    }

    var w = numSegmentsW + 1;
    var base;
    for (ci = 0; ci < numSegmentsW; ++ci) {
        for (hi = 0; hi < numSegmentsH - 1; ++hi) {
            base = ci + hi*w;
            indices.push(base, base + w + 1, base + w);
            indices.push(base, base + 1, base + w + 1);

            if (doubleSided) {
                indices.push(base, base + w, base + w + 1);
                indices.push(base, base + w + 1, base + 1);
            }
        }

        // tip only needs 1 tri
        base = ci + (numSegmentsH - 1)*w;
        indices.push(base, base + 1, base + w + 1);
    }

    // bottom
    var indexOffset = positions.length / 3;
    var halfH = height * .5;
    for (ci = 0; ci < numSegmentsW; ++ci) {
        angle = ci * rcpNumSegmentsW * Math.PI * 2;
        var u = Math.sin(angle);
        var v = Math.cos(angle);
        cx = u * radius;
        cy = v * radius;

        u = -u * .5 + .5;
        v = v * .5 + .5;

        switch (alignment) {
            case ConePrimitive.ALIGN_X:
                positions.push(-halfH, cy, cx);
                if (normals) normals.push(-1, 0, 0);
                if (uvs) uvs.push(v, u);
                break;

            case ConePrimitive.ALIGN_Z:
                positions.push(cx, -cy, -halfH);
                if (normals) normals.push(0, 0, -1);
                if (uvs) uvs.push(u, 1.0 - v);
                break;
            default:
                positions.push(cx, -halfH, cy);
                if (normals) normals.push(0, -1, 0);
                if (uvs) uvs.push(u, 1.0 - v);
                break;
        }
    }

    for (ci = 1; ci < numSegmentsW - 1; ++ci)
        indices.push(indexOffset, indexOffset + ci + 1, indexOffset + ci);
};

export { ConePrimitive };