varying vec3 normal;

uniform vec3 color;
uniform float alpha;

#if defined(COLOR_MAP) || defined(NORMAL_MAP)|| defined(SPECULAR_MAP)|| defined(ROUGHNESS_MAP) || defined(MASK_MAP)
varying vec2 texCoords;
#endif

#ifdef COLOR_MAP
uniform sampler2D colorMap;
#endif

#ifdef MASK_MAP
uniform sampler2D maskMap;
#endif

#ifdef NORMAL_MAP
varying vec3 tangent;
varying vec3 bitangent;

uniform sampler2D normalMap;
#endif

uniform float minRoughness;
uniform float maxRoughness;
uniform float normalSpecularReflectance;
uniform float metallicness;

#if defined(ALPHA_THRESHOLD)
uniform float alphaThreshold;
#endif

#if defined(SPECULAR_MAP) || defined(ROUGHNESS_MAP)
uniform sampler2D specularMap;
#endif

#ifdef VERTEX_COLORS
varying vec3 vertexColor;
#endif

HX_GeometryData hx_geometry()
{
    vec4 outputColor = vec4(color, alpha);

    #ifdef VERTEX_COLORS
        outputColor.xyz *= vertexColor;
    #endif

    #ifdef COLOR_MAP
        outputColor *= texture2D(colorMap, texCoords);
    #endif

    #ifdef MASK_MAP
        outputColor.w *= texture2D(maskMap, texCoords).x;
    #endif

    #ifdef ALPHA_THRESHOLD
        if (outputColor.w < alphaThreshold) discard;
    #endif

    float metallicnessOut = metallicness;
    float specNormalReflOut = normalSpecularReflectance;
    float roughnessOut = minRoughness;

    vec3 fragNormal = normal;
    #ifdef NORMAL_MAP
        vec4 normalSample = texture2D(normalMap, texCoords);
        mat3 TBN;
        TBN[2] = normalize(normal);
        TBN[0] = normalize(tangent);
        TBN[1] = normalize(bitangent);

        fragNormal = TBN * (normalSample.xyz - .5);

        #ifdef NORMAL_ROUGHNESS_MAP
            roughnessOut = mix(maxRoughness, minRoughness, normalSample.w);
        #endif
    #endif

    #if defined(SPECULAR_MAP) || defined(ROUGHNESS_MAP)
          vec4 specSample = texture2D(specularMap, texCoords);
          roughnessOut = mix(maxRoughness, minRoughness, specSample.x);

          #ifdef SPECULAR_MAP
              specNormalReflOut *= specSample.y;
              metallicnessOut *= specSample.z;
          #endif
    #endif

    HX_GeometryData data;
    data.color = hx_gammaToLinear(outputColor);
    data.normal = normalize(fragNormal);
    data.metallicness = metallicnessOut;
    data.normalSpecularReflectance = specNormalReflOut;
    data.roughness = roughnessOut;
    data.emission = vec3(0.0);
    return data;
}