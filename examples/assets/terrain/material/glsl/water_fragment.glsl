uniform sampler2D waveMap;

uniform sampler2D hx_normalDepthBuffer;
uniform sampler2D hx_backbuffer;

uniform mat4 hx_viewMatrix;
uniform float roughness;
uniform float hx_cameraNearPlaneDistance;
uniform float hx_cameraFrustumRange;
uniform float indexOfRefraction;
uniform vec3 absorbDensity;
uniform float inScatterDensity;
uniform vec3 color;

varying_in vec2 uv1;
varying_in vec2 uv2;
varying_in vec4 proj;
varying_in vec3 viewPos;

HX_GeometryData hx_geometry()
{
    vec2 screenCoord = proj.xy / proj.w * .5 + .5;
    vec4 normalDepth = texture2D(hx_normalDepthBuffer, screenCoord);
    vec3 normal1 = texture2D(waveMap, uv1).xyz - .5;
    vec3 normal2 = texture2D(waveMap, uv2).xyz - .5;
    vec3 normal = normal1 + normal2 * .5;
    normal.z *= 5.0;
    normal = mat3(hx_viewMatrix) * normalize(normal);

    float depth = hx_decodeLinearDepth(normalDepth);
    float absViewY = hx_cameraNearPlaneDistance + depth * hx_cameraFrustumRange;
    vec3 backPos = viewPos / viewPos.y * absViewY;
    float dist = distance(viewPos, backPos);

    vec3 viewDir = normalize(viewPos);

    vec3 refractDir = refract(viewDir, normal, 1.0 / indexOfRefraction);
// cannot clamp, as this would make any deep region have the same offset, which looks weird
    vec2 offset = refractDir.xz / max(proj.w, 1.0) * min(dist, 1.0);

    screenCoord += offset;

    float alpha = hx_linearStep(0.0, 3.0, dist);

    // mirror wrapping looks best
    if (screenCoord.x > 1.0) screenCoord.x -= (screenCoord.x - 1.0) * 2.0;
    else if (screenCoord.x < 0.0) screenCoord.x -= screenCoord.x * 2.0;

    if (screenCoord.y > 1.0) screenCoord.y -= (screenCoord.y - 1.0) * 2.0;
    else if (screenCoord.y < 0.0) screenCoord.y -= screenCoord.y * 2.0;

    vec4 backColor = texture2D(hx_backbuffer, screenCoord);

    float scatter = exp(-inScatterDensity * dist);
    vec3 absorb;
    absorb.x = exp(-absorbDensity.x * dist);
    absorb.y = exp(-absorbDensity.y * dist);
    absorb.z = exp(-absorbDensity.z * dist);

    HX_GeometryData data;
    // there's no diffuse colour here, or light probes would add in light here
    data.color = vec4(color * (1.0 - scatter), alpha);
    data.normal = normal;
    data.metallicness = 0.0;
    data.normalSpecularReflectance = 0.027;
    data.roughness = roughness;
    data.occlusion = alpha; // this causes probes not to affect the edges as much, just blends in nicely without requiring real (slow) blending
    data.emission = backColor.xyz * scatter * absorb;
    // in this case, the lighting model expects the data object to contain the water's absorption properties and the distance of the ray between surface and bottom
    return data;
}