/**
 * @author derschmale <http://www.derschmale.com>
 */
var project = new DemoProject();

project.queueAssets = function(assetLibrary)
{
    assetLibrary.queueAsset("albedo", "textures/brick_wall/diffuse.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG);
    assetLibrary.queueAsset("normals", "textures/brick_wall/normals.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG);
    assetLibrary.queueAsset("specular", "textures/brick_wall/specular.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG);
};

project.onInit = function()
{
    this.camera.addComponent(new OrbitController());

    initScene(this.scene, this.assetLibrary);
};

window.onload = function ()
{
    var options = new HX.InitOptions();
    project.init(document.getElementById('webglContainer'), options);
};

function initScene(scene, assetLibrary)
{
    var ambientLight = new HX.AmbientLight();
    ambientLight.intensity = .02;
    var light1 = new HX.PointLight();
    var light2 = new HX.PointLight();
    var light3 = new HX.PointLight();
    light1.color = 0xff2020;
    light2.color = 0x2020ff;
    light3.color = 0x20ff20;

    // convert to entity
	ambientLight = new HX.Entity(ambientLight);
    light1 = new HX.Entity(light1);
    light2 = new HX.Entity(light2);
    light3 = new HX.Entity(light3);

    scene.attach(ambientLight);
    scene.attach(light1);
    scene.attach(light2);
    scene.attach(light3);

    var component = new AnimateOrbitComponent();
    component.axis = new HX.Float4(1.0, 1.0, 1.0);
    component.radius = 2.0;
    light1.addComponent(component);

    component = new AnimateOrbitComponent();
    component.axis = new HX.Float4(-1.0, 1.0, 1.0);
    component.radius = 2.0;
    component.speed = .7;
    light2.addComponent(component);

    component = new AnimateOrbitComponent();
    component.axis = new HX.Float4(1.0, 1.0, 1.0);
    component.radius = 2.0;
    component.speed = .1;
    light3.addComponent(component);

    var material = new HX.BasicMaterial();
    material.lightingModel = HX.LightingModel.GGX;
    material.colorMap = assetLibrary.get("albedo");
    material.normalMap = assetLibrary.get("normals");
    material.specularMap = assetLibrary.get("specular");
    material.roughness = .6;
    material.roughnessRange = .4;

    var primitive = new HX.SpherePrimitive(
        {
            radius:.25,
            numSegmentsH: 20,
            numSegmentsW: 30
        });

    var modelInstance = new HX.Entity(new HX.MeshInstance(primitive, material));
    modelInstance.addComponent(new AnimateRotateComponent());
    scene.attach(modelInstance);
}