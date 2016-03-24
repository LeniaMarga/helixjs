/**
 *
 * @constructor
 */
HX.CascadeShadowCasterCollector = function(numCascades)
{
    HX.SceneVisitor.call(this);
    this._renderCameras = null;
    this._bounds = new HX.BoundingAABB();
    this._numCascades = numCascades;
    this._cullPlanes = null;
    this._splitPlanes = null;
    this._numCullPlanes = 0;
    this._renderLists = [];
    this._renderItemPool = new HX.RenderItemPool();
};

HX.CascadeShadowCasterCollector.prototype = Object.create(HX.SceneVisitor.prototype);

HX.CascadeShadowCasterCollector.prototype.getRenderList = function(index) { return this._renderLists[index]; };

HX.CascadeShadowCasterCollector.prototype.collect = function(camera, scene)
{
    this._collectorCamera = camera;
    this._bounds.clear();
    this._renderItemPool.reset();

    for (var i = 0; i < this._numCascades; ++i) {
        this._renderLists[i] = [];
    }

    scene.acceptVisitor(this);
};

HX.CascadeShadowCasterCollector.prototype.getBounds = function()
{
    return this._bounds;
};

HX.CascadeShadowCasterCollector.prototype.setRenderCameras = function(cameras)
{
    this._renderCameras = cameras;
};

HX.CascadeShadowCasterCollector.prototype.setCullPlanes = function(cullPlanes, numPlanes)
{
    this._cullPlanes = cullPlanes;
    this._numCullPlanes = numPlanes;
};

HX.CascadeShadowCasterCollector.prototype.setSplitPlanes = function(splitPlanes)
{
    this._splitPlanes = splitPlanes;
};

HX.CascadeShadowCasterCollector.prototype.visitModelInstance = function (modelInstance, worldMatrix, worldBounds)
{
    if (modelInstance._castShadows === false) return;

    this._bounds.growToIncludeBound(worldBounds);

    var passIndex = HX.MaterialPass.SHADOW_DEPTH_PASS;

    var numCascades = this._numCascades;
    var numMeshes = modelInstance.numMeshInstances;

    //if (!worldBounds.intersectsConvexSolid(this._cullPlanes, this._numCullPlanes)) return;

    var lastCascade = numCascades - 1;
    for (var cascade = 0; cascade <= lastCascade; ++cascade) {

        var renderList = this._renderLists[cascade];
        var renderCamera = this._renderCameras[cascade];

        var planeSide;

        // always contained in lastCascade if we made it this far
        if (cascade === lastCascade)
            planeSide = HX.PlaneSide.BACK;
        else
            planeSide = worldBounds.classifyAgainstPlane(this._splitPlanes[cascade]);

        if (planeSide !== HX.PlaneSide.FRONT) {
            for (var meshIndex = 0; meshIndex < numMeshes; ++meshIndex) {
                var meshInstance = modelInstance.getMeshInstance(meshIndex);
                var material = meshInstance.material;

                if (material.hasPass(passIndex)) {
                    var renderItem = this._renderItemPool.getItem();
                    renderItem.pass = material.getPass(passIndex);
                    renderItem.meshInstance = meshInstance;
                    renderItem.worldMatrix = worldMatrix;
                    renderItem.camera = renderCamera;
                    renderItem.material = material;

                    renderList.push(renderItem);
                }
            }

            // completely contained in the cascade, so it won't be in more distant slices
            if (planeSide === HX.PlaneSide.BACK)
                return;
        }
    }

    // no need to test the last split plane, if we got this far, it's bound to be in it

};

HX.CascadeShadowCasterCollector.prototype.qualifies = function(object)
{
    return object.visible && object.worldBounds.intersectsConvexSolid(this._cullPlanes, this._numCullPlanes);
};

/**
 *
 * @constructor
 */
HX.CascadeShadowMapRenderer = function(light, numCascades, shadowMapSize)
{
    this._light = light;
    this._numCascades = numCascades || 3;
    if (this._numCascades > 4) this._numCascades = 4;
    this._shadowMapSize = shadowMapSize || 1024;
    this._shadowMapInvalid = true;
    this._fboFront = null;
    this._fboBack = null;
    this._depthBuffer = null;   // only used if depth textures aren't supported

    this._shadowMap = this._createShadowBuffer();
    this._shadowBackBuffer = HX.DirectionalLight.SHADOW_FILTER.blurShader? this._createShadowBuffer() : null;

    this._shadowMatrices = [ new HX.Matrix4x4(), new HX.Matrix4x4(), new HX.Matrix4x4(), new HX.Matrix4x4() ];
    this._transformToUV = [ new HX.Matrix4x4(), new HX.Matrix4x4(), new HX.Matrix4x4(), new HX.Matrix4x4() ];
    this._inverseLightMatrix = new HX.Matrix4x4();
    this._splitRatios = null;
    this._splitDistances = null;
    this._shadowMapCameras = null;
    this._collectorCamera = new HX.OrthographicOffCenterCamera();
    this._minZ = 0;
    this._numCullPlanes = 0;
    this._cullPlanes = [];
    this._localBounds = new HX.BoundingAABB();
    this._casterCollector = new HX.CascadeShadowCasterCollector(this._numCascades);

    this._initSplitProperties();
    this._initCameras();

    this._viewports = [];
};

HX.CascadeShadowMapRenderer.prototype =
{
    setNumCascades: function(value)
    {
        if (this._numCascades === value) return;
        this._numCascades = value;
        this._invalidateShadowMap();
        this._initSplitProperties();
        this._initCameras();
        this._casterCollector = new HX.CascadeShadowCasterCollector(value);
    },

    setShadowMapSize: function(value)
    {
        if (this._setShadowMapSize === value) return;
        this._setShadowMapSize = value;
        this._invalidateShadowMap();
    },

    render: function(viewCamera, scene)
    {
        if (this._shadowMapInvalid)
            this._initShadowMap();

        this._inverseLightMatrix.inverseAffineOf(this._light.worldMatrix);
        this._updateCollectorCamera(viewCamera);
        this._updateSplits(viewCamera);
        this._updateCullPlanes(viewCamera);
        this._collectShadowCasters(scene);
        this._updateCascadeCameras(viewCamera, this._casterCollector.getBounds());

        HX.pushRenderTarget(this._fboFront);

        var passType = HX.MaterialPass.SHADOW_DEPTH_PASS;
        HX.setClearColor(HX.Color.WHITE);
        HX.clear();

        for (var cascadeIndex = 0; cascadeIndex < this._numCascades; ++cascadeIndex)
        {
            var viewport = this._viewports[cascadeIndex];
            HX_GL.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            HX.RenderUtils.renderPass(this, passType, this._casterCollector.getRenderList(cascadeIndex));
        }

        if (HX.DirectionalLight.SHADOW_FILTER.blurShader) {
            this._blur();
        }

        HX.popRenderTarget();
    },

    _updateCollectorCamera: function(viewCamera)
    {
        var corners = viewCamera.frustum._corners;
        var min = new HX.Float4();
        var max = new HX.Float4();
        var tmp = new HX.Float4();

        this._inverseLightMatrix.transformPoint(corners[0], min);
        max.copyFrom(min);

        for (var i = 1; i < 8; ++i) {
            this._inverseLightMatrix.transformPoint(corners[i], tmp);
            min.minimize(tmp);
            max.maximize(tmp);
        }

        this._minZ = min.z;

        this._collectorCamera.matrix.copyFrom(this._light.worldMatrix);
        this._collectorCamera._invalidateWorldMatrix();
        this._collectorCamera.setBounds(min.x, max.x + 1, max.y + 1, min.y);
        this._collectorCamera._setRenderTargetResolution(this._shadowMap._width, this._shadowMap._height);
    },

    _updateSplits: function(viewCamera)
    {
        var nearDist = viewCamera.nearDistance;
        var frustumRange = viewCamera.farDistance - nearDist;
        var plane = new HX.Float4(0.0, 0.0, -1.0, 0.0);
        var matrix = viewCamera.worldMatrix;

        for (var i = 0; i < this._numCascades; ++i) {
            this._splitDistances[i] = plane.w = -(nearDist + this._splitRatios[i] * frustumRange);
            matrix.transform(plane, this._splitPlanes[i]);
        }
    },

    _updateCascadeCameras: function(viewCamera, bounds)
    {
        this._localBounds.transformFrom(bounds, this._inverseLightMatrix);

        var minBound = this._localBounds.minimum;
        var maxBound = this._localBounds.maximum;

        var scaleSnap = 1.0;	// always scale snap to a meter

        var localNear = new HX.Float4();
        var localFar = new HX.Float4();
        var min = new HX.Float4();
        var max = new HX.Float4();

        var corners = viewCamera.frustum.corners;

        // camera distances are suboptimal? need to constrain to local near too?

        var nearRatio = 0;
        for (var cascade = 0; cascade < this._numCascades; ++cascade) {
            var farRatio = this._splitRatios[cascade];
            var camera = this._shadowMapCameras[cascade];

            camera.matrix = this._light.worldMatrix;

            // figure out frustum bound
            for (var i = 0; i < 4; ++i) {
                var nearCorner = corners[i];
                var farCorner = corners[i + 4];

                var nx = nearCorner.x;
                var ny = nearCorner.y;
                var nz = nearCorner.z;
                var dx = farCorner.x - nx;
                var dy = farCorner.y - ny;
                var dz = farCorner.z - nz;
                localNear.x = nx + dx*nearRatio;
                localNear.y = ny + dy*nearRatio;
                localNear.z = nz + dz*nearRatio;
                localFar.x = nx + dx*farRatio;
                localFar.y = ny + dy*farRatio;
                localFar.z = nz + dz*farRatio;

                this._inverseLightMatrix.transformPoint(localNear, localNear);
                this._inverseLightMatrix.transformPoint(localFar, localFar);

                if (i === 0) {
                    min.copyFrom(localNear);
                    max.copyFrom(localNear);
                }
                else {
                    min.minimize(localNear);
                    max.maximize(localNear);
                }

                min.minimize(localFar);
                max.maximize(localFar);
            }

            nearRatio = farRatio;

            // do not render beyond range of view camera or scene depth
            min.z = Math.max(this._minZ, min.z);

            var left = Math.max(min.x, minBound.x);
            var right = Math.min(max.x, maxBound.x);
            var bottom = Math.max(min.y, minBound.y);
            var top = Math.min(max.y, maxBound.y);

            var width = right - left;
            var height = top - bottom;

            width = Math.ceil(width / scaleSnap) * scaleSnap;
            height = Math.ceil(height / scaleSnap) * scaleSnap;
            width = Math.max(width, scaleSnap);
            height = Math.max(height, scaleSnap);

            // snap to pixels
            var offsetSnapX = this._shadowMap._width / width * .5;
            var offsetSnapY = this._shadowMap._height / height * .5;

            left = Math.floor(left * offsetSnapX) / offsetSnapX;
            bottom = Math.floor(bottom * offsetSnapY) / offsetSnapY;
            right = left + width;
            top = bottom + height;

            var softness = HX.DirectionalLight.SHADOW_FILTER.softness ? HX.DirectionalLight.SHADOW_FILTER.softness : .1;

            camera.setBounds(left - softness, right + softness, top + softness, bottom - softness);

            // cannot clip nearDistance to frustum, because casters in front may cast into this frustum
            camera.nearDistance = -maxBound.z;
            camera.farDistance = -min.z;

            camera._setRenderTargetResolution(this._shadowMap._width, this._shadowMap._height);

            this._shadowMatrices[cascade].multiply(this._transformToUV[cascade], camera.viewProjectionMatrix);
        }
    },

    _updateCullPlanes: function(viewCamera)
    {
        var frustum = this._collectorCamera.frustum;
        var planes = frustum._planes;

        for (var i = 0; i < 4; ++i)
            this._cullPlanes[i] = planes[i];

        this._numCullPlanes = 4;

        frustum = viewCamera.frustum;
        planes = frustum._planes;

        var dir = this._light.direction;

        for (var j = 0; j < 6; ++j) {
            var plane = planes[j];

            // view frustum planes facing away from the light direction mark a boundary beyond which no shadows need to be known
            if (HX.dot3(plane, dir) > 0.001)
                this._cullPlanes[this._numCullPlanes++] = plane;
        }
    },

    _collectShadowCasters: function(scene)
    {
        this._casterCollector.setSplitPlanes(this._splitPlanes);
        this._casterCollector.setCullPlanes(this._cullPlanes, this._numCullPlanes);
        this._casterCollector.setRenderCameras(this._shadowMapCameras);
        this._casterCollector.collect(this._collectorCamera, scene);
    },

    get splitDistances()
    {
        return this._splitDistances;
    },

    /**
     * The ratios that define every cascade's split distance. Reset when numCascades change. 1 is at the far plane, 0 is at the near plane.
     * @param r1
     * @param r2
     * @param r3
     * @param r4
     */
    setSplitRatios: function(r1, r2, r3, r4)
    {
        this._splitRatios[0] = r1;
        this._splitRatios[1] = r2;
        this._splitRatios[2] = r3;
        this._splitRatios[3] = r4;
    },

    getShadowMatrix: function(cascade)
    {
        return this._shadowMatrices[cascade];
    },

    dispose: function()
    {
        HX.Renderer.call.dispose(this);
        if (this._depthBuffer) {
            this._depthBuffer.dispose();
            this._depthBuffer = null;
        }
        this._shadowMap.dispose();
        this._shadowMap = null;
    },

    _invalidateShadowMap: function()
    {
        this._shadowMapInvalid = true;
    },

    _initShadowMap: function()
    {
        var numMapsW = this._numCascades > 1? 2 : 1;
        var numMapsH = Math.ceil(this._numCascades / 2);

        var texWidth = this._shadowMapSize * numMapsW;
        var texHeight = this._shadowMapSize * numMapsH;

        this._shadowMap.initEmpty(texWidth, texHeight, HX.DirectionalLight.SHADOW_FILTER.getShadowMapFormat(), HX.DirectionalLight.SHADOW_FILTER.getShadowMapDataType());
        if (!this._depthBuffer) this._depthBuffer = new HX.ReadOnlyDepthBuffer();
        if (!this._fboFront) this._fboFront = new HX.FrameBuffer(this._shadowMap, this._depthBuffer);

        this._depthBuffer.init(texWidth, texHeight);
        this._fboFront.init();
        this._shadowMapInvalid = false;

        if (this._shadowBackBuffer) {
            this._shadowBackBuffer.initEmpty(texWidth, texHeight, HX.DirectionalLight.SHADOW_FILTER.getShadowMapFormat(), HX.DirectionalLight.SHADOW_FILTER.getShadowMapDataType());
            if (!this._fboBack) this._fboBack = new HX.FrameBuffer(this._shadowBackBuffer, this._depthBuffer);
            this._fboBack.init();
            this._fboBack.init();
        }

        this._viewports = [];
        this._viewports.push(new HX.Rect(0, 0, this._shadowMapSize, this._shadowMapSize));
        this._viewports.push(new HX.Rect(this._shadowMapSize, 0, this._shadowMapSize, this._shadowMapSize));
        this._viewports.push(new HX.Rect(0, this._shadowMapSize, this._shadowMapSize, this._shadowMapSize));
        this._viewports.push(new HX.Rect(this._shadowMapSize, this._shadowMapSize, this._shadowMapSize, this._shadowMapSize));

        this._initViewportMatrices(1.0 / numMapsW, 1.0 / numMapsH);
    },

    _initSplitProperties: function()
    {
        var ratio = 1.0;
        this._splitRatios = [];
        this._splitDistances = [0, 0, 0, 0];
        this._splitPlanes = [];
        for (var i = this._numCascades - 1; i >= 0; --i)
        {
            this._splitRatios[i] = ratio;
            this._splitPlanes[i] = new HX.Float4();
            this._splitDistances[i] = 0;
            ratio *= .33;
        }
    },

    _initCameras: function()
    {
        this._shadowMapCameras = [];
        for (var i = this._numCascades - 1; i >= 0; --i)
        {
            this._shadowMapCameras[i] = new HX.OrthographicOffCenterCamera();
        }
    },

    _initViewportMatrices: function(scaleW, scaleH)
    {
        var halfVec = new HX.Float4(.5,.5,.5);
        for (var i = 0; i < 4; ++i) {
            // transform [-1, 1] to [0 - 1] (also for Z)
            this._transformToUV[i].fromScale(.5);
            this._transformToUV[i].appendTranslation(halfVec);

            // transform to tiled size
            this._transformToUV[i].appendScale(scaleW, scaleH, 1.0);
        }

        this._transformToUV[1].appendTranslation(new HX.Float4(0.5, 0.0, 0.0));
        this._transformToUV[2].appendTranslation(new HX.Float4(0.0, 0.5, 0.0));
        this._transformToUV[3].appendTranslation(new HX.Float4(0.5, 0.5, 0.0));
    },

    _createShadowBuffer: function()
    {
        var tex = new HX.Texture2D();
        //tex.filter = HX.TextureFilter.NEAREST_NOMIP;
        // while filtering doesn't actually work on encoded values, it looks much better this way since at least it can filter
        // the MSB, which is useful for ESM etc
        tex.filter = HX.TextureFilter.BILINEAR_NOMIP;
        tex.wrapMode = HX.TextureWrapMode.CLAMP;
        return tex;
    },

    _blur: function()
    {
        var shader = HX.DirectionalLight.SHADOW_FILTER.blurShader;

        for (var i = 0; i < HX.DirectionalLight.SHADOW_FILTER.numBlurPasses; ++i) {
            HX.pushRenderTarget(this._fboBack);
            shader.execute(HX.RectMesh.DEFAULT, this._shadowMap, 1.0 / this._shadowMapSize, 0.0);
            HX.popRenderTarget();

            shader.execute(HX.RectMesh.DEFAULT, this._shadowBackBuffer, 0.0, 1.0 / this._shadowMapSize);
        }
    }
};