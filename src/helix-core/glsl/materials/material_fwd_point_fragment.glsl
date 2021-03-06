varying_in vec3 hx_viewPosition;

uniform HX_PointLight hx_pointLight;

uniform sampler2D hx_shadowMap;

void main()
{
    HX_GeometryData data = hx_geometry();

    vec3 viewVector = normalize(hx_viewPosition);
    vec3 diffuse, specular;

    vec3 specularColor = mix(vec3(data.normalSpecularReflectance), data.color.xyz, data.metallicness);
    data.color.xyz *= 1.0 - data.metallicness;

    hx_calculateLight(hx_pointLight, data, viewVector, hx_viewPosition, specularColor, diffuse, specular);

    hx_FragColor = vec4(diffuse * data.color.xyz + specular, data.color.w);

    if (hx_pointLight.castShadows == 1)
        hx_FragColor.xyz *= hx_calculateShadows(hx_pointLight, hx_shadowMap, hx_viewPosition);
}