varying vec2 texCoords;
varying vec3 normal;
varying vec3 viewVector;
varying vec2 screenUV;

#ifdef COLOR_MAP
uniform sampler2D colorMap;
#else
uniform vec3 color;
#endif

#ifdef NORMAL_MAP
varying vec3 tangent;
varying vec3 bitangent;

uniform sampler2D normalMap;
#endif

uniform sampler2D hx_backbuffer;
uniform sampler2D hx_gbufferDepth;

uniform float hx_cameraNearPlaneDistance;
uniform float hx_cameraFrustumRange;

uniform float refractiveRatio;   // the ratio of refractive indices

vec2 getPreciseRefractedUVOffset(vec3 normal, float distance)
{
    vec3 refractionVector = refract(normalize(viewVector), normal, refractiveRatio);   // close enough
    return -(refractionVector.xy - viewVector.xy) / (viewVector.z + refractionVector.z * distance);
}

void main()
{
    vec4 outputColor;
    #ifdef COLOR_MAP
        outputColor = texture2D(colorMap, texCoords);
    #else
        outputColor = vec4(color, 1.0);
    #endif

    vec3 fragNormal = normal;
    #ifdef NORMAL_MAP
        vec4 normalSample = texture2D(normalMap, texCoords);
        mat3 TBN;
        TBN[2] = normalize(normal);
        TBN[0] = normalize(tangent);
        TBN[1] = normalize(bitangent);

        fragNormal = TBN * (normalSample.xyz * 2.0 - 1.0);
    #endif

    // use the immediate background depth value for a distance estimate
    // it would actually be possible to have the back faces rendered with their depth values only, to get a more local scattering

    float depth = hx_sampleLinearDepth(hx_gbufferDepth, texCoords);
    float distance = depth * hx_cameraFrustumRange - viewVector.z - hx_cameraNearPlaneDistance;

    vec2 samplePos = screenUV + getPreciseRefractedUVOffset(fragNormal, distance);

    vec4 background = texture2D(hx_backbuffer, samplePos);
    gl_FragColor = outputColor * background;
}