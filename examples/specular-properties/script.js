/**
 * @author derschmale <http://www.derschmale.com>
 */

var project = new DemoProject();

project.queueAssets = function(assetLibrary)
{
    assetLibrary.queueAsset("skybox-specular", "textures/skybox/skybox_specular.hcm", HX.AssetLibrary.Type.ASSET, HX.HCM);
    assetLibrary.queueAsset("skybox-irradiance", "textures/skybox/skybox_irradiance.hcm", HX.AssetLibrary.Type.ASSET, HX.HCM);
};

project.onInit = function()
{
    initCamera(this.camera);
    initScene(this.scene, this.assetLibrary);
};

window.onload = function ()
{
    var options = new HX.InitOptions();
    options.defaultLightingModel = HX.LightingModel.GGX;
    options.hdr = true;
    project.init(document.getElementById('webglContainer'), options);
};

function initCamera(camera)
{
    var controller = new HX.OrbitController();
    controller.azimuth = Math.PI * .5;
    controller.polar = Math.PI * .5;
    controller.radius = 1.6;

    var tonemap = new HX.ReinhardToneMapping(false);
    tonemap.exposure = 1.0;

    camera.addComponents([ controller, tonemap ]);
}

function initScene(scene, assetLibrary)
{
    var light = new HX.DirectionalLight();
    light.color = new HX.Color(1.0,.8,.6);
    light.direction = new HX.Float4(0.0, -0.3, -1.0, 0.0);
    light.intensity = .3;
    scene.attach(light);

    var skyboxSpecularTexture = assetLibrary.get("skybox-specular");
    var skyboxIrradianceTexture = assetLibrary.get("skybox-irradiance");

    // top level of specular texture is the original skybox texture
    var skybox = new HX.Skybox(skyboxSpecularTexture);
    scene.skybox = skybox;
    var lightProbe = new HX.LightProbe(skyboxIrradianceTexture, skyboxSpecularTexture);
    scene.attach(lightProbe);

    var primitive = new HX.SpherePrimitive(
        {
            radius:.075,
            numSegmentsH: 10,
            numSegmentsW: 20
        });

    var numX = 10;
    var numY = 7;
    for (var x = 0; x < numX; ++x) {
        for (var y = 0; y < numY; ++y) {
            var material = new HX.BasicMaterial();
            var gold = new HX.Color(1, 0.765557, 0.336057);
            material.color = gold;
            material.roughness = x / (numX - 1.0);
            material.metallicness = y / (numY - 1.0);

            var modelInstance = new HX.ModelInstance(primitive, material);
            modelInstance.position.x = ((x + .5) / numX - .5) * 3.0;
            modelInstance.position.y = -((y + .5) / numY - .5) * 1.5;
            modelInstance.position.z = 0.0;
            scene.attach(modelInstance);
        }
    }
}