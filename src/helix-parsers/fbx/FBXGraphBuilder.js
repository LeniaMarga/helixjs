// Could also create an ASCII deserializer
HX.FBXGraphBuilder = function()
{

};

HX.FBXGraphBuilder.prototype =
{
    build: function(rootRecord)
    {
        this._templates = {};
        this._objects = {};

        // fbx scene node
        var rootNode = new HX.FbxNode();
        this._objects["00"] = rootNode;

        // handle templates
        this._processTemplates(rootRecord.getChildByName("Definitions"));
        this._processObjects(rootRecord.getChildByName("Objects"));
        this._processConnections(rootRecord.getChildByName("Connections"));
        return rootNode;
    },

    _processTemplates: function(definitions)
    {
        var len = definitions.children.length;
        for (var i = 0; i < len; ++i) {
            var child = definitions.children[i];
            if (child.name === "ObjectType") {
                var template = child.getChildByName("PropertyTemplate");
                if (!template) continue;
                var subclass = template.data[0];
                var type = child.data[0];
                var node = this._createNode(type, subclass, template);

                if (node)
                    this._assignProperties(node, template.getChildByName("Properties70"));

                this._templates[type] = node;
            }
        }
    },

    _processObjects: function(definitions)
    {
        var len = definitions.children.length;
        for (var i = 0; i < len; ++i) {
            var obj = null;
            var node = definitions.children[i];
            switch (node.name) {
                case "Geometry":
                    obj = this._processGeometry(node);
                    break;
                case "NodeAttribute":
                    // at this point, we're only supporting meshes
                    // TODO: FbxNodeAttribute will be cast to FbxCamera etc
                    obj = new HX.FbxNodeAttribute();
                    obj.type = node.data[2];
                    break;
                case "Model":
                    obj = new HX.FbxNode();
                    obj.type = node.data[2];
                    break;
                case "Material":
                    obj = new HX.FbxMaterial();
                    break;
                case "Video":
                    obj = new HX.FbxVideo();
                    var rel = node.getChildByName("RelativeFilename");
                    obj.relativeFilename = rel? rel.data[0] : null;
                    break;
                case "Texture":
                    obj = new HX.FbxFileTexture();
                    var rel = node.getChildByName("RelativeFilename");
                    obj.relativeFilename = rel? rel.data[0] : null;
                    break;
                case "AnimationStack":
                    // unused so far
                    obj = new HX.FbxAnimStack();
                    break;
                case "AnimationLayer":
                    // unused so far
                    obj = new HX.FbxAnimLayer();
                    break;
                case "Pose":
                    obj = new HX.FbxPose();
                    break;
                case "Deformer":
                    obj = new HX.FbxDeformer();
                    break;
                case "AnimationCurve":
                case "AnimationCurveNode":
                    obj = {};
                    break;
                default:
                    node.printDebug(false);
            }

            if (obj) {
                obj.name = this._getObjectDefName(node);

                if (this._templates[node.name])
                    obj.copyProperties(this._templates[node.name]);

                this._assignProperties(obj, node.getChildByName("Properties70"));

                var uid = node.data[0];
                this._objects[uid] = obj;
            }
        }
    },

    _processConnections: function(definitions)
    {
        var len = definitions.children.length;
        for (var i = 0; i < len; ++i) {
            var node = definitions.children[i];
            var mode = node.data[0];
            var child = this._objects[node.data[1]];
            var parent = this._objects[node.data[2]];

            if (mode === "OO") {
                //console.log(child, child.name, " -> ", parent, parent.name);
                parent.connectObject(child);
            }
            else if (mode === "OP") {
                //console.log(child, child.name, " -> ", parent, parent.name, " Mode ", node.data[3]);
                parent.connectProperty(child, node.data[3]);
            }
        }
    },

    _createNode: function(name, subclass)
    {
        if (name === "Material")
            return new HX.FbxMaterial();

        if (HX[subclass]) return new HX[subclass];
    },

    _assignProperties: function(target, properties)
    {
        if (!properties) return;

        var len = properties.numChildren;
        for (var i = 0; i < len; ++i) {
            var prop = properties.getChild(i);
            if (target.hasOwnProperty(prop.data[0])) {
                target[prop.data[0]] = this._getPropertyValue(prop);
            }
        }
    },

    _getPropertyValue: function(prop)
    {
        var data = prop.data;
        switch (data[1]) {
            case "Vector3D":
            case "Lcl Translation":
            case "Lcl Scaling":
            case "Lcl Rotation":
                return new HX.Float4(data[4], data[5], data[6]);
            case "bool":
            case "Visibility":
            case "Visibility Inheritance":
                return data[4] !== 0;
            case "ColorRGB":
            case "Color":
                return new HX.Color(data[4], data[5], data[6]);
            case "enum":
            case "double":
            case "float":
            case "int":
            case "KString":
                return data[4];
            case "object":
                return null;    // TODO: this will be connected using OP?
        }
    },

    _processGeometry: function(objDef)
    {
        var geometry = new HX.FbxMesh();
        var len = objDef.numChildren;
        var layerMap = {};

        for (var i = 0; i < len; ++i) {
            var child = objDef.getChild(i);
            switch (child.name) {
                case "Vertices":
                    geometry.vertices = child.data[0];
                    break;
                case "PolygonVertexIndex":
                    geometry.indices = child.data[0];
                    break;
                case "Layer":
                    geometry.layerElements = this._processLayers(child, layerMap);
                    break;
                default:
                    layerMap[child.name] = child;
                    break;
            }
        }
        // ignoring edges
        return geometry;
    },

    _processLayers: function(objDef, layerMap)
    {
        var layerElements = [];
        var len = objDef.numChildren;
        for (var i = 0; i < len; ++i) {
            var layerElement = objDef.getChild(i);
            var name = layerElement.getChildByName("Type").data[0];
            var layer = this._processLayerElement(layerMap[name]);
            layerElements.push(layer);
        }
        return layerElements;
    },

    _processLayerElement: function(objDef)
    {
        var layerElement = new HX.FbxLayerElement();
        var len = objDef.length;

        // property TypedIndex unsupported

        for (var i = 0; i < len; ++i) {
            var node = objDef.getChild(i);
            switch(node.name) {
                case "MappingInformationType":
                    var mapMode = node.data[0];
                    layerElement.mappingInformationType =   mapMode === "ByPolygonVertex"?  HX.FbxLayerElement.MAPPING_TYPE.BY_POLYGON_VERTEX :
                                                            mapMode === "ByPolygon"?        HX.FbxLayerElement.MAPPING_TYPE._Mapping.BY_POLYGON :
                                                            mapMode === "AllSame"?          HX.FbxLayerElement.MAPPING_TYPE._Mapping.ALL_SAME :
                                                                                            HX.FbxLayerElement.MAPPING_TYPE._Mapping.BY_CONTROL_POINT;
                    break;
                case "ReferenceInformationType":
                    layerElement.referenceInformationType = node.data[0] === "Direct"? HX.FbxLayerElement.REFERENCE_TYPE.DIRECT : HX.FbxLayerElement.REFERENCE_TYPE.INDEX_TO_DIRECT;
                    break;
                case "Normals":
                case "UV":
                case "Materials":
                case "Smoothing":
                    layerElement.type = node.name;
                    layerElement.data = node.data[0];
                    break;
            }
        }

        return layerElement;
    },

    _getObjectDefName: function(objDef)
    {
        return objDef.data[1].split(HX.FBXGraphBuilder._STRING_DEMARCATION)[0];
    }
};

HX.FBXGraphBuilder._STRING_DEMARCATION = String.fromCharCode(0, 1);