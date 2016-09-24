#define HX_PROBE_K0 .00098
#define HX_PROBE_K1 .9921
/*
var minRoughness = 0.0014;
var maxPower = 2.0 / (minRoughness * minRoughness) - 2.0;
var maxMipFactor = (exp2(-10.0/Math.sqrt(maxPower)) - HX_PROBE_K0)/HX_PROBE_K1;
var HX_PROBE_SCALE = 1.0 / maxMipFactor
*/

#define HX_PROBE_SCALE

vec3 hx_calculateDiffuseProbeLight(samplerCube texture, vec3 normal)
{
	return hx_gammaToLinear(textureCube(texture, normal).xyz);
}

vec3 hx_calculateSpecularProbeLight(samplerCube texture, float numMips, vec3 reflectedViewDir, vec3 fresnelColor, float geometricFactor, float roughness)
{
    #ifdef HX_TEXTURE_LOD
    // knald method:
        float power = 2.0/(roughness * roughness) - 2.0;
        float factor = (exp2(-10.0/sqrt(power)) - HX_PROBE_K0)/HX_PROBE_K1;
//        float mipLevel = numMips * (1.0 - clamp(factor * HX_PROBE_SCALE, 0.0, 1.0));
        float mipLevel = numMips * (1.0 - clamp(factor, 0.0, 1.0));
        vec4 specProbeSample = textureCubeLodEXT(texture, reflectedViewDir, mipLevel);
    #else
        vec4 specProbeSample = textureCube(texture, reflectedViewDir);
    #endif
	return hx_gammaToLinear(specProbeSample.xyz) * fresnelColor * geometricFactor;
}