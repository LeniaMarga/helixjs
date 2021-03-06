/**
 * @author derschmale <http://www.derschmale.com>
 */

var project = new DemoProject();

project.queueAssets = function(assetLibrary)
{
    assetLibrary.queueAsset("skybox", "skyboxes/river_rocks/river_rocks_1k.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG, {equiToCube: true, cubeSize: 512});
    assetLibrary.queueAsset("metal-normals", "textures/Tarnished_Metal_01/Tarnished_Metal_01_normal.png", HX.AssetLibrary.Type.ASSET, HX.PNG);
    assetLibrary.queueAsset("metal-specular", "textures/Tarnished_Metal_01/Tarnished_Metal_01_specular.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG);
};

project.onInit = function()
{
    var controller = new OrbitController();
    controller.radius = 1.5;
    this.camera.addComponent(controller);

    initScene(this.scene, this.assetLibrary);
};

window.onload = function ()
{
    var options = new HX.InitOptions();
    project.init(document.getElementById('webglContainer'), options);
};

function initScene(scene, assetLibrary)
{
    var skyboxTexture = assetLibrary.get("skybox");

    // use it as skybox
    var skybox = new HX.Skybox(skyboxTexture);
    scene.skybox = skybox;

    // use the same texture as environment map
    var lightProbe = new HX.LightProbe(null, skyboxTexture);

    var material = new HX.BasicMaterial();
    material.normalMap = assetLibrary.get("metal-normals");
    material.specularMap = assetLibrary.get("metal-specular");
    material.roughness = .25;
    material.roughnessRange = -.1;  // invert roughness by making range negative
    material.metallicness = 1.0;
    material.lightingModel = HX.LightingModel.GGX;

	scene.attach(new HX.Entity(lightProbe));

    var primitive = new HX.TorusPrimitive(
        {
            numSegmentsH: 30,
            numSegmentsW: 40,
            tubeRadius:.2,
            scaleU: 5,
            scaleV: 2,
        });

    var modelInstance = new HX.Entity(new HX.MeshInstance(primitive, material));
    scene.attach(modelInstance);
}