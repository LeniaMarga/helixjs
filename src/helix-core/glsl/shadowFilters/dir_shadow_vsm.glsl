vec4 hx_getShadowMapValue(float depth)
{
    // TODO: add dFdx, dFdy stuff
    return vec4(hx_floatToRG8(depth), hx_floatToRG8(depth * depth));
}

float hx_readShadow(sampler2D shadowMap, vec3 viewPos, mat4 shadowMapMatrix, float depthBias)
{
    vec4 shadowMapCoord = shadowMapMatrix * vec4(viewPos, 1.0);
    vec4 s = texture2D(shadowMap, shadowMapCoord.xy);
    vec2 moments = vec2(hx_RG8ToFloat(s.xy), hx_RG8ToFloat(s.zw));
    shadowMapCoord.z += depthBias;

    float variance = moments.y - moments.x * moments.x;
    variance = max(variance, HX_VSM_MIN_VARIANCE);
    // transparents could be closer to the light than casters
    float diff = max(shadowMapCoord.z - moments.x, 0.0);
    float upperBound = variance / (variance + diff*diff);
    return saturate((upperBound - HX_VSM_LIGHT_BLEED_REDUCTION) / HX_VSM_LIGHT_BLEED_REDUCTION_RANGE);
}