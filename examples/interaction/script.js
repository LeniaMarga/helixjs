/**
 * @author derschmale <http://www.derschmale.com>
 */

var project = new DemoProject();
var indicator;

project.queueAssets = function(assetLibrary)
{
    assetLibrary.queueAsset("albedo", "textures/brick_wall/diffuse.jpg", HX.AssetLibrary.Type.ASSET, HX.JPG);
};

project.onInit = function()
{
    initScene(this.scene, this.assetLibrary);

    this.camera.addComponent(new OrbitController());

    this.input = new HX.Input();
    var mouse = new HX.Mouse();
    mouse.map(HX.Mouse.POS_X, "posX");
    mouse.map(HX.Mouse.POS_Y, "posY");
    this.input.enable(mouse);
};

window.onload = function ()
{
    project.init(document.getElementById('webglContainer'));
};

function initScene(scene, assetLibrary)
{
    var material = new HX.BasicMaterial({
        colorMap: assetLibrary.get("albedo")
    });

    var primitive = new HX.SpherePrimitive(
        {
            radius: .25
        });


    var instance = new HX.Entity(new HX.MeshInstance(primitive, material));
    instance.name = "Sphere";
    instance.rotation.fromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.attach(instance);


    material = new HX.BasicMaterial();
    material.color = 0xffff00;

    primitive = new HX.SpherePrimitive(
        {
            radius: .01
        });

    indicator = new HX.Entity(new HX.MeshInstance(primitive, material));
    indicator.visible = false;
    indicator.name = "Indicator";
    scene.attach(indicator);
}

project.onUpdate = function(dt)
{
    // TODO:
    // For now, raycasting happens manually
    // We may want a set of interaction components
    // fe: a simple Clickable component etc

    var x = this.input.getValue("posX");
    var y = this.input.getValue("posY");
    var ray = this.camera.getRay(x * 2.0 - 1.0, -(y * 2.0 - 1.0));

    indicator.visible = false;

    var rayCaster = new HX.Raycaster();
    var hitData = rayCaster.cast(ray, this.scene);

    if (hitData) {
        indicator.visible = true;
        indicator.position.copyFrom(hitData.point);
    }
};