uniform float hx_cameraFrustumRange;
uniform float hx_cameraNearPlaneDistance;
uniform vec2 hx_rcpRenderTargetResolution;
uniform mat4 hx_projectionMatrix;

uniform float strengthPerRay;
uniform float halfSampleRadius;
uniform float bias;
uniform float rcpFallOffDistance;
uniform vec2 ditherScale;

uniform sampler2D hx_normalDepthBuffer;
uniform sampler2D sampleDirTexture;
uniform sampler2D ditherTexture;

varying_in vec2 uv;
varying_in vec3 viewDir;
varying_in vec3 frustumCorner;

vec3 getViewPos(vec2 sampleUV)
{
    vec4 smp = texture2D(hx_normalDepthBuffer, sampleUV);
    float depth = hx_decodeLinearDepth(smp);
    float viewY = hx_cameraNearPlaneDistance + depth * hx_cameraFrustumRange;
    vec3 viewPos = frustumCorner * vec3(sampleUV.x * 2.0 - 1.0, 1.0, sampleUV.y * 2.0 - 1.0);
    return viewPos * viewY;
}

// Retrieves the occlusion factor for a particular sample
float getSampleOcclusion(vec2 sampleUV, vec3 centerViewPos, vec3 centerNormal, vec3 tangent, inout float topOcclusion)
{
    vec3 sampleViewPos = getViewPos(sampleUV);

    // get occlusion factor based on candidate horizon elevation
    vec3 horizonVector = sampleViewPos - centerViewPos;
    float horizonVectorLength = length(horizonVector);

    float occlusion;

    // If the horizon vector points away from the tangent, make an estimate
    if (dot(tangent, horizonVector) < 0.0)
        occlusion = .5;
    else
        occlusion = dot(centerNormal, horizonVector) / horizonVectorLength;

    // this adds occlusion only if angle of the horizon vector is higher than the previous highest one without branching
    float diff = max(occlusion - topOcclusion, 0.0);
    topOcclusion = max(occlusion, topOcclusion);

    // attenuate occlusion contribution using distance function 1 - (d/f)^2
    float distanceFactor = 1.0 - saturate(horizonVectorLength * rcpFallOffDistance);
    return diff * distanceFactor;
}

// Retrieves the occlusion for a given ray
float getRayOcclusion(vec2 direction, float jitter, vec2 projectedRadii, vec3 centerViewPos, vec3 centerNormal)
{
    // calculate the nearest neighbour sample along the direction vector
    vec2 texelSizedStep = direction * hx_rcpRenderTargetResolution;
    direction *= projectedRadii;

    // gets the tangent for the current ray, this will be used to handle opposing horizon vectors
    // Tangent is corrected with respect to face normal by projecting it onto the tangent plane defined by the normal
    vec3 tangent = getViewPos(uv + texelSizedStep) - centerViewPos;
    tangent -= dot(centerNormal, tangent) * centerNormal;

    vec2 stepUV = direction.xy / float(NUM_SAMPLES_PER_RAY - 1);

    // jitter the starting position for ray marching between the nearest neighbour and the sample step size
    vec2 jitteredOffset = mix(texelSizedStep, stepUV, jitter);
    //stepUV *= 1.0 + jitter * .1;
    vec2 sampleUV = uv + jitteredOffset;

    // top occlusion keeps track of the occlusion contribution of the last found occluder.
    // set to bias value to avoid near-occluders
    float topOcclusion = bias;
    float occlusion = 0.0;

    // march!
    for (int step = 0; step < NUM_SAMPLES_PER_RAY; ++step) {
        occlusion += getSampleOcclusion(sampleUV, centerViewPos, centerNormal, tangent, topOcclusion);
        sampleUV += stepUV;
    }

    return occlusion;
}

void main()
{
    vec4 normalDepth = texture2D(hx_normalDepthBuffer, uv);
    vec3 centerNormal = hx_decodeNormal(normalDepth);
    float centerDepth = hx_decodeLinearDepth(normalDepth);
    float viewY = hx_cameraNearPlaneDistance + centerDepth * hx_cameraFrustumRange;
    vec3 centerViewPos = viewY * viewDir;

    // clamp z to a minimum, so the radius does not get excessively large in screen-space
    float projRadius = halfSampleRadius / max(centerViewPos.y, 7.0);
    vec2 projectedRadii = projRadius * vec2(hx_projectionMatrix[0][0], hx_projectionMatrix[1][2]);

    // do not take more steps than there are pixels
    float totalOcclusion = 0.0;

    vec2 randomFactors = texture2D(ditherTexture, uv * ditherScale).xy;

    vec2 rayUV = vec2(0.0);
    for (int i = 0; i < NUM_RAYS; ++i) {
        rayUV.x = (float(i) + randomFactors.x) / float(NUM_RAYS);
        vec2 sampleDir = texture2D(sampleDirTexture, rayUV).xy * 2.0 - 1.0;
        totalOcclusion += getRayOcclusion(sampleDir, randomFactors.y, projectedRadii, centerViewPos, centerNormal);
    }

    totalOcclusion = 1.0 - clamp(strengthPerRay * totalOcclusion, 0.0, 1.0);
    hx_FragColor = vec4(vec3(totalOcclusion), 1.0);
}