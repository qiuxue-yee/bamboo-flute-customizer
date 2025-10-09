/**
 * ThreeDManager - 竹笛定制器的三维场景管理类（综合）
 *
 * 本类负责完整的三维场景管理，包括：
 * - 场景初始化与优化
 * - 相机系统与平滑过渡
 * - 渲染管线配置
 * - 动态光照管理
 * - 模型加载与优化
 * - 控制与动画
 * - 性能监控与优化
 * - 导出与调试能力
 */

// 通过 <script> 标签加载的全局 THREE 对象
const THREE = window.THREE;

// 通过 <script> 标签加载的全局加载器/导出器
const GLTFLoader = window.THREE.GLTFLoader;
const GLTFExporter = window.THREE.GLTFExporter;

export class ThreeDManager {
    /**
     * 构造函数
     * @param {HTMLElement} container - 渲染画布容器
     * @param {Function} onReady - 场景就绪回调
     * @param {Object} options - 配置项
     */
    constructor(container, onReady, options = {}) {
        this.container = container;
        this.onReady = onReady;
        this.options = {
            ...this.getDefaultOptions(),
            ...options
        };

        // Three.js核心组件
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.orthographicCamera = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        // 场景对象管理
        this.sceneObjects = new Map();
        this.currentModel = null;
        this.modelCache = new Map();
        this.animationMixer = null;
        this.animations = [];

        // 光照系统
        this.lights = {
            ambient: null,
            directional: null,
            point: null,
            hemisphere: null
        };

        // 性能监控
        this.stats = null;
        this.fps = 0;
        this.frameTime = 0;
        this.memory = 0;
        this.isAnimating = true;

        // 调试开关
        this.debugMode = false;
        this.wireframeMode = false;
        this.performanceOverlay = null;

        // 自适应尺寸缓存
        this.lastWidth = 0;
        this.lastHeight = 0;
        
        // 有名事件句柄，便于清理
        this._onResize = null;
        this._onVisibility = null;
        this._resizeIntervalId = null;
        
        // 双轴相机旋转系统（简化 OrbitControls 的替代）
        this.rotationState = {
            currentAngle: 0,     // 水平角（度）
            currentElevation: 15, // 俯仰角（度）
            radius: 15,          // 相机到模型中心距离
            baseHeight: 10,      // 基础高度
            isRotating: false,   // 是否正在旋转（防止并发）
            rotationSpeed: 2,    // 单步水平旋转速度（度）
            elevationSpeed: 1,   // 单步俯仰旋转速度（度）
            minElevation: -Infinity,   // 俯仰下限
            maxElevation: Infinity,    // 俯仰上限
            rotationInterval: null, // 连续旋转定时器
            elevationInterval: null // 连续俯仰定时器
        };

        // 初始化三维场景
        this.init();
    }

    /**
     * 默认配置
     */
    getDefaultOptions() {
        return {
            // 场景设置
            backgroundColor: 0x1a1a1a,  // 深色背景，提升对比度
            fogColor: 0xcccccc,
            fogNear: 10,
            fogFar: 50,

            // 相机设置
            cameraFov: 45,  // 标准视场
            cameraNear: 0.01,  // 近裁剪面，避免穿模
            cameraFar: 1000,
            cameraPosition: { x: 0, y: 0, z: 8 },  // 初始位置：正面查看整体

            // 渲染器设置
            antialias: true,
            alpha: true,
            pixelRatio: Math.min(window.devicePixelRatio, 2),
            shadowMapEnabled: true,
            shadowMapType: THREE.PCFSoftShadowMap,

            // 光照设置
            ambientIntensity: 0.6,  // 更亮的环境光以显示细节
            directionalIntensity: 1.0,  // 更强的定向光
            pointIntensity: 0.6,

            // 控制设置
            enableDamping: true,
            dampingFactor: 0.05,
            autoRotate: false,
            autoRotateSpeed: 2.0,

            // 性能设置
            enableStats: false,
            targetFPS: 60,
            enableLOD: true,

            // 调试设置
            enableDebug: false,
            showGrid: false,
            showAxes: false
        };
    }

    /**
     * Initialize the complete 3D scene
     */
    init() {
        try {
            // 初始化场景
            this.initScene();

            // 初始化渲染器
            this.initRenderer();

            // 初始化相机
            this.initCameras();

            // 初始化控制器
            this.initControls();

            // 初始化光照
            this.initLighting();

            // 初始化性能监控
            this.initPerformanceMonitoring();

            // 初始化调试工具
            this.initDebugTools();

            // 初始化事件处理器
            this.initEventHandlers();

            // 加载默认模型
            this.loadDefaultModel();

            // 开始渲染循环
            this.animate();

            if (window.__DEV__) console.log('ThreeDManager初始化成功');

        } catch (error) {
            if (window.__DEV__) console.error('ThreeDManager初始化失败:', error);
            throw error;
        }
    }

    /**
     * Initialize Three.js scene
     */
    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);

        // 添加雾效以增强深度感知
        this.scene.fog = new THREE.Fog(
            this.options.fogColor,
            this.options.fogNear,
            this.options.fogFar
        );

        // 如果启用则添加网格
        if (this.options.showGrid) {
            const gridHelper = new THREE.GridHelper(20, 20);
            this.scene.add(gridHelper);
        }
    }

    /**
     * Initialize WebGL renderer
     */
    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.options.antialias,
            alpha: this.options.alpha,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: true
        });

        // 配置渲染器设置
        this.renderer.setPixelRatio(this.options.pixelRatio);
        this.renderer.setSize(
            this.container.clientWidth,
            this.container.clientHeight
        );

        // 启用阴影
        this.renderer.shadowMap.enabled = this.options.shadowMapEnabled;
        this.renderer.shadowMap.type = this.options.shadowMapType;

        // 启用色调映射
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // 确保画布样式以完全覆盖容器
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        
        // 添加到容器
        this.container.appendChild(this.renderer.domElement);
        
        if (window.__DEV__) console.log(`Initial 3D viewport size: ${this.container.clientWidth}x${this.container.clientHeight}`);
    }

    /**
     * Initialize camera systems with Blender Z-up to Three.js Y-up coordinate conversion
     */
    initCameras() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const blueprint = this.getCameraBlueprint();

        // 创建具有精确Blender属性的主透视相机
        this.camera = new THREE.PerspectiveCamera(
            this.options.cameraFov, // 保持现有的FOV计算
            aspect,
            blueprint.config.near,   // 使用Blender近裁剪面
            blueprint.config.far     // 使用Blender远裁剪面
        );

        // 设置Blender焦距
        this.camera.setFocalLength(blueprint.config.focalLength);
        this.camera.updateProjectionMatrix();

        // 简化：直接将相机添加到场景（暂时不进行坐标转换）
        // 待办：复杂的坐标转换导致视角问题
        this.scene.add(this.camera);
        
        if (window.__DEV__) console.log('相机直接添加到场景（简化设置）');
        
        // 调试：添加坐标系可视化
        this.addDebugVisualization();
        
        // 设置简单的初始相机位置（将在模型加载后调整）
        this.camera.position.set(15, 10, 15);
        this.camera.lookAt(0, 0, 0);
        
        // 相机将在模型加载后根据实际模型大小进行微调
        if (window.__DEV__) console.log('相机设置为简单初始位置: (15, 10, 15) 看向原点');
        
        if (window.__DEV__) console.log('相机以简化设置初始化:', {
            focalLength: blueprint.config.focalLength,
            near: blueprint.config.near,
            far: blueprint.config.far,
            initialPosition: [15, 10, 15],
            lookingAt: [0, 0, 0]
        });
        
        // 调试：设置后记录初始相机状态
        setTimeout(() => this.logCameraDebugInfo(), 100);
        
        // 调试：添加全局调试函数
        this.addGlobalDebugFunctions();

        // 正交相机（用于2D视图）
        const frustumSize = 10;
        this.orthographicCamera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            this.options.cameraNear,
            this.options.cameraFar
        );

        this.orthographicCamera.position.set(0, 5, 0);
        this.orthographicCamera.lookAt(0, 0, 0);
    }

    /**
     * Initialize orbit controls
     */
    initControls() {
        // OrbitControls已完全移除以支持引导式定制
        this.controls = null;
        if (window.__DEV__) console.log('OrbitControls已禁用 - 使用引导式定制模式');
        if (window.__DEV__) console.log('使用视图按钮导航相机位置');
    }

    /**
     * Initialize lighting system
     */
    initLighting() {
        // 环境光用于整体照明
        this.lights.ambient = new THREE.AmbientLight(
            0xffffff,
            this.options.ambientIntensity
        );
        this.scene.add(this.lights.ambient);

        // 方向光用于阴影和主照明
        this.lights.directional = new THREE.DirectionalLight(
            0xffffff,
            this.options.directionalIntensity
        );
        this.lights.directional.position.set(5, 10, 5);
        this.lights.directional.castShadow = true;

        // 配置阴影属性
        this.lights.directional.shadow.mapSize.width = 2048;
        this.lights.directional.shadow.mapSize.height = 2048;
        this.lights.directional.shadow.camera.near = 0.5;
        this.lights.directional.shadow.camera.far = 50;
        this.lights.directional.shadow.camera.left = -10;
        this.lights.directional.shadow.camera.right = 10;
        this.lights.directional.shadow.camera.top = 10;
        this.lights.directional.shadow.camera.bottom = -10;

        this.scene.add(this.lights.directional);

        // 点光源用于强调照明
        this.lights.point = new THREE.PointLight(
            0xffd700,
            this.options.pointIntensity,
            100
        );
        this.lights.point.position.set(-3, 5, 3);
        this.lights.point.castShadow = true;
        this.scene.add(this.lights.point);

        // 半球光用于环境照明
        this.lights.hemisphere = new THREE.HemisphereLight(
            0x87CEEB, // 天空颜色
            0x8B4513, // 地面颜色
            0.3
        );
        this.scene.add(this.lights.hemisphere);
    }

    /**
     * Initialize performance monitoring
     */
    initPerformanceMonitoring() {
        if (this.options.enableStats) {
            // 如果可用则初始化Stats.js
            if (typeof Stats !== 'undefined') {
                this.stats = new Stats();
                this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
                this.stats.dom.style.position = 'fixed';
                this.stats.dom.style.top = '0px';
                this.stats.dom.style.left = '0px';
                this.stats.dom.style.zIndex = '100';
                document.body.appendChild(this.stats.dom);
            }
        }

        // 创建性能叠加层（仅当启用时）
        if (this.options.enableStats) {
        this.createPerformanceOverlay();
        }
    }

    /**
     * Initialize debug tools
     */
    initDebugTools() {
        if (!this.options.enableDebug) return;

        this.debugHelpers = {
            lights: []
        };

        // 灯光助手
        const lightHelper1 = new THREE.DirectionalLightHelper(this.lights.directional, 1);
        const lightHelper2 = new THREE.PointLightHelper(this.lights.point, 0.5);

        this.debugHelpers.lights.push(lightHelper1, lightHelper2);
    }

    /**
     * Initialize event handlers
     */
    initEventHandlers() {
        // 窗口大小调整处理程序（存储命名处理程序以便正确清理）
        this._onResize = () => this.onWindowResize();
        window.addEventListener('resize', this._onResize);
        
        // 开发者工具的额外大小调整检测
        let resizeTimeout;
        const checkResize = () => {
            const currentWidth = this.container.clientWidth;
            const currentHeight = this.container.clientHeight;
            
            if (this.lastWidth !== currentWidth || this.lastHeight !== currentHeight) {
                this.lastWidth = currentWidth;
                this.lastHeight = currentHeight;
                this.onWindowResize();
            }
        };
        
        // 定期检查大小变化（用于开发者工具）
        this._resizeIntervalId = setInterval(checkResize, 500);
        
        // 强制初始大小调整以确保正确的大小
        setTimeout(() => this.onWindowResize(), 100);

        // 可见性变化处理程序以提高性能
        this._onVisibility = () => { this.isAnimating = !document.hidden; };
        document.addEventListener('visibilitychange', this._onVisibility);

        // 键盘快捷键（添加类似Fusion的视图控制）
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);

            const k = event.key;
            if (!this.currentModel) return;

            const fit = () => this.centerAndFrameModel(this.currentModel);
            const setCam = (pos, up) => {
                this.camera.position.copy(pos);
                if (up) this.camera.up.copy(up);
                this.camera.lookAt(0, 0, 0);
                // 控制已禁用
            };

        // 引导式定制模式 - 不需要直接热键
        // 相机控制通过UI按钮处理
        });
    }

    /**
     * DYNAMIC CAMERA BLUEPRINT - Based on actual loaded and scaled model
     * Calculates camera distances dynamically based on current model size
     * Fixes the issue where camera moves too far when switching views
     */
    getCameraBlueprint() {
        // 根据实际缩放模型大小计算相机距离
        let modelLength = 10;  // 默认缩放大小
        let modelWidth = 0.5;  // 默认缩放大小
        
        if (this.currentModel) {
            const box = new THREE.Box3().setFromObject(this.currentModel);
            const size = box.getSize(new THREE.Vector3());
            modelLength = Math.max(size.x, size.y, size.z);
            modelWidth = Math.min(size.x, size.y, size.z);
        }
        
        // 使用适合缩放模型的合理距离（不是原来的642米！）
        const optimalDistance = modelLength * 1.5; // 对缩放模型来说更近  
        const sideDistance = modelLength * 1.2;    // 侧视图距离
        
        if (window.__DEV__) console.log(`Camera blueprint calculated:
  - Model length: ${modelLength.toFixed(2)} units
  - Model width: ${modelWidth.toFixed(2)} units  
  - Optimal distance: ${optimalDistance.toFixed(2)} units
  - Side distance: ${sideDistance.toFixed(2)} units`);
        
        return {
            // 大型模型的相机镜头和裁剪属性
            config: {
                focalLength: 50,           // 焦距（毫米）
                near: 1,                   // 裁剪起始 - increased for large scale
                far: modelLength * 10      // 结束 - far enough for scaled model
            },

            // 为实际模型缩放动态计算的预定义视图
            views: {
                front: {
                    // 将相机定位以更好地查看前部文字区域（向右移动并靠近）
                    position: { x: sideDistance * 1.3, y: optimalDistance * 0.2, z: optimalDistance * 0.4 },
                    rotation: { x: -5, y: 20, z: 0 }, // 更好的角度来查看纹理
                    description: '正面视图 - 文字定制区域'
                },
                back: {
                    // 将相机定位以查看背部图像区域（向右移动以获得更好的视角）
                    position: { x: -sideDistance * 1.3, y: optimalDistance * 0.2, z: optimalDistance * 0.4 },
                    rotation: { x: -5, y: -20, z: 0 }, // 更好的角度来查看纹理
                    description: '背面视图 - 图像定制区域'
                },
                overview: {
                    // 概览位置调整以获得更好的完整视图
                    position: { x: sideDistance * 0.8, y: optimalDistance * 0.5, z: optimalDistance * 0.8 },
                    rotation: { x: -15, y: 10, z: 0 },
                    description: '概览视图 - 完整笛子显示'
                }
            }
        };
    }

    /**
     * Switch camera to precise Blender-defined view with smooth GSAP animation
     */
    switchToView(viewName, duration = 1.2) {
        if (!this.currentModel) {
            if (window.__DEV__) console.warn('💥 No model loaded, cannot switch view');
            return;
        }

        const blueprint = this.getCameraBlueprint();
        const targetView = blueprint.views[viewName];
        
        if (!targetView) {
            if (window.__DEV__) console.warn(`未知视图: ${viewName}. 可用: ${Object.keys(blueprint.views).join(', ')}`);
            return;
        }
        
        // 获取当前模型尺寸以进行动态定位
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // 直接使用目标位置（已在getCameraBlueprint中基于模型大小计算）
        const targetPosition = targetView.position;
        
        if (window.__DEV__) console.log(`切换到${viewName}视图: ${targetView.description}`);
        if (window.__DEV__) console.log(`目标位置: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
        if (window.__DEV__) console.log(`目标旋转: (${targetView.rotation.x}°, ${targetView.rotation.y}°, ${targetView.rotation.z}°)`);
        if (window.__DEV__) console.log(`模型尺寸: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);

        // 使用GSAP进行平滑相机动画
        if (typeof gsap !== 'undefined') {
            // 动画位置
            gsap.to(this.camera.position, {
                duration: duration,
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                ease: "power3.inOut"
            });

            // 确保相机在位置动画后看向模型中心
            setTimeout(() => {
                this.camera.lookAt(0, 0, 0);
                if (window.__DEV__) console.log(`Camera animation to ${viewName} completed`);
                this.logCameraDebugInfo();
            }, duration * 1000);
        } else {
            // 如果GSAP未加载则立即定位的回退方案
            if (window.__DEV__) console.warn('GSAP not available, using immediate positioning');
            this.camera.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
            this.camera.lookAt(0, 0, 0);
            if (window.__DEV__) console.log(`Camera positioned immediately at ${viewName}`);
        }
    }

    /**
     * Add debugging visualization for coordinate system analysis
     */
    addDebugVisualization() {
        if (!this.options.enableDebug) return;
        if (window.__DEV__) console.log('Adding debug visualization for coordinate system analysis');
        if (window.__DEV__) console.log('Debug visualization added');
    }
    
    /**
     * Add visual markers at expected camera positions
     */
    addCameraPositionMarkers() {
        const blueprint = this.getCameraBlueprint();
        
        Object.entries(blueprint.views).forEach(([viewName, viewData]) => {
            const geometry = new THREE.SphereGeometry(10, 8, 6);
            const material = new THREE.MeshBasicMaterial({ 
                color: viewName === 'front' ? 0x00ff00 : 0xff0000,
                wireframe: true
            });
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(viewData.position.x, viewData.position.y, viewData.position.z);
            marker.name = `CameraMarker_${viewName}`;
            this.scene.add(marker);
            
            if (window.__DEV__) console.log(`📍 Added ${viewName} camera marker at:`, viewData.position);
        });
    }
    
    /**
     * Log detailed camera debugging information
     */
    logCameraDebugInfo() {
        if (!this.camera || !this.cameraGroup) return;
        
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        this.camera.getWorldPosition(worldPos);
        this.camera.getWorldQuaternion(worldQuat);
        
        const euler = new THREE.Euler().setFromQuaternion(worldQuat);
        
        if (window.__DEV__) console.log('🎥 Camera Debug Info:');
        if (window.__DEV__) console.log('  Local Position:', this.camera.position.toArray());
        if (window.__DEV__) console.log('  World Position:', worldPos.toArray());
        if (window.__DEV__) console.log('  Local Rotation (deg):', [
            THREE.MathUtils.radToDeg(this.camera.rotation.x),
            THREE.MathUtils.radToDeg(this.camera.rotation.y),
            THREE.MathUtils.radToDeg(this.camera.rotation.z)
        ]);
        if (window.__DEV__) console.log('  World Rotation (deg):', [
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
        ]);
        if (window.__DEV__) console.log('  Camera Group Rotation (deg):', [
            THREE.MathUtils.radToDeg(this.cameraGroup.rotation.x),
            THREE.MathUtils.radToDeg(this.cameraGroup.rotation.y),
            THREE.MathUtils.radToDeg(this.cameraGroup.rotation.z)
        ]);
    }

    /**
     * Validate coordinate system implementation
     */
    validateCoordinateSystem() {
        if (window.__DEV__) console.log('🔍 Validating coordinate system implementation...');
        
        const blueprint = this.getCameraBlueprint();
        const frontView = blueprint.views.front;
        
        // Check if camera is at expected position
        const worldPos = new THREE.Vector3();
        this.camera.getWorldPosition(worldPos);
        
        const expectedDistance = Math.sqrt(
            frontView.position.x ** 2 + 
            frontView.position.y ** 2 + 
            frontView.position.z ** 2
        );
        
        const actualDistance = worldPos.length();
        
        if (window.__DEV__) console.log('Coordinate System Validation:');
        if (window.__DEV__) console.log(`  Expected camera distance from origin: ${expectedDistance.toFixed(2)}`);
        if (window.__DEV__) console.log(`  Actual camera distance from origin: ${actualDistance.toFixed(2)}`);
        if (window.__DEV__) console.log(`  Distance difference: ${Math.abs(expectedDistance - actualDistance).toFixed(2)}`);
        
        // Check if model is visible
        if (this.currentModel) {
            const modelBox = new THREE.Box3().setFromObject(this.currentModel);
            const modelCenter = modelBox.getCenter(new THREE.Vector3());
            const modelSize = modelBox.getSize(new THREE.Vector3());
            
            if (window.__DEV__) console.log('📦 Model Validation:');
            if (window.__DEV__) console.log(`  Model center: (${modelCenter.x.toFixed(2)}, ${modelCenter.y.toFixed(2)}, ${modelCenter.z.toFixed(2)})`);
            if (window.__DEV__) console.log(`  Model size: (${modelSize.x.toFixed(2)}, ${modelSize.y.toFixed(2)}, ${modelSize.z.toFixed(2)})`);
            if (window.__DEV__) console.log(`  Expected model center: (0, 0, 0)`);
            
            const centerOffset = modelCenter.length();
            if (window.__DEV__) console.log(`  Center offset from origin: ${centerOffset.toFixed(2)}`);
            
            if (centerOffset > 10) {
                if (window.__DEV__) console.warn('Model may not be properly centered!');
            }
        }
        
        // Validate camera orientation
        const euler = new THREE.Euler().setFromQuaternion(
            this.camera.getWorldQuaternion(new THREE.Quaternion())
        );
        
        if (window.__DEV__) console.log('🎥 Camera Orientation Validation:');
        if (window.__DEV__) console.log(`  Expected rotation (deg): (${frontView.rotation.x}, ${frontView.rotation.y}, ${frontView.rotation.z})`);
        if (window.__DEV__) console.log(`  Actual world rotation (deg): (${THREE.MathUtils.radToDeg(euler.x).toFixed(2)}, ${THREE.MathUtils.radToDeg(euler.y).toFixed(2)}, ${THREE.MathUtils.radToDeg(euler.z).toFixed(2)})`);
        
        if (window.__DEV__) console.log('Coordinate system validation complete');
    }
    
    /**
     * Test camera positioning against Blender reference
     */
    testCameraPositioning() {
        if (window.__DEV__) console.log('Testing camera positioning against Blender reference...');
        
        const blueprint = this.getCameraBlueprint();
        
        Object.entries(blueprint.views).forEach(([viewName, viewData]) => {
            if (window.__DEV__) console.log(`\nTesting ${viewName} view:`);
            if (window.__DEV__) console.log(`  Expected position: (${viewData.position.x}, ${viewData.position.y}, ${viewData.position.z})`);
            if (window.__DEV__) console.log(`  Expected rotation: (${viewData.rotation.x}°, ${viewData.rotation.y}°, ${viewData.rotation.z}°)`);
            
            // Temporarily apply this view
            this.camera.position.set(viewData.position.x, viewData.position.y, viewData.position.z);
            this.camera.rotation.set(
                THREE.MathUtils.degToRad(viewData.rotation.x),
                THREE.MathUtils.degToRad(viewData.rotation.y),
                THREE.MathUtils.degToRad(viewData.rotation.z)
            );
            
            // Check world coordinates
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            this.camera.getWorldPosition(worldPos);
            this.camera.getWorldQuaternion(worldQuat);
            
            if (window.__DEV__) console.log(`  Actual world position: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`);
            
            const euler = new THREE.Euler().setFromQuaternion(worldQuat);
            if (window.__DEV__) console.log(`  Actual world rotation: (${THREE.MathUtils.radToDeg(euler.x).toFixed(2)}°, ${THREE.MathUtils.radToDeg(euler.y).toFixed(2)}°, ${THREE.MathUtils.radToDeg(euler.z).toFixed(2)}°)`);
        });
        
        // Reset to front view
        const frontView = blueprint.views.front;
        this.camera.position.set(frontView.position.x, frontView.position.y, frontView.position.z);
        this.camera.rotation.set(
            THREE.MathUtils.degToRad(frontView.rotation.x),
            THREE.MathUtils.degToRad(frontView.rotation.y),
            THREE.MathUtils.degToRad(frontView.rotation.z)
        );
        
        if (window.__DEV__) console.log('Camera positioning test complete');
    }
    
    /**
     * Add global debugging functions accessible from browser console
     */
    addGlobalDebugFunctions() {
        // Make debugging functions globally accessible
        window.debugCamera = () => this.logCameraDebugInfo();
        window.validateCoords = () => this.validateCoordinateSystem();
        window.testCameraPos = () => this.testCameraPositioning();
        window.switchToFront = () => this.switchToView('front');
        window.switchToBack = () => this.switchToView('back');
        window.resetCamera = () => {
            const blueprint = this.getCameraBlueprint();
            const frontView = blueprint.views.front;
            this.camera.position.set(frontView.position.x, frontView.position.y, frontView.position.z);
            this.camera.rotation.set(
                THREE.MathUtils.degToRad(frontView.rotation.x),
                THREE.MathUtils.degToRad(frontView.rotation.y),
                THREE.MathUtils.degToRad(frontView.rotation.z)
            );
            this.logCameraDebugInfo();
        };
        
        if (window.__DEV__) console.log('🛠 Global debug functions added:');
        if (window.__DEV__) console.log('  debugCamera() - Log camera debug info');
        if (window.__DEV__) console.log('  validateCoords() - Validate coordinate system');
        if (window.__DEV__) console.log('  testCameraPos() - Test camera positioning');
        if (window.__DEV__) console.log('  switchToFront() - Switch to front view');
        if (window.__DEV__) console.log('  switchToBack() - Switch to back view');
        if (window.__DEV__) console.log('  resetCamera() - Reset camera to front view');
    }

    /**
     * Get the actual height of the loaded model
     */
    getModelHeight() {
        if (!this.currentModel) return 642; // Default fallback
        
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        
        // Return the Y dimension (height after proper orientation)
        return size.y;
    }

    // Legacy method for backward compatibility
    togglePresetViews() {
        this._viewToggle = !this._viewToggle;
        const viewName = this._viewToggle ? 'front' : 'back';
        this.switchToView(viewName);
    }

    /**
     * Load default 3D model - Display model for preview + Printable models for editing
     */
    async loadDefaultModel() {
        try {
            if (window.__DEV__) console.log('开始双模型加载流程...');
            
            // Load display model for preview
            if (window.__DEV__) console.log('加载显示模型: ./assets/Dizi_Display.glb');
            const displayModel = await this.loadModel('./assets/Dizi_Display.glb');
            this.displayModel = displayModel; // Store separately
            
            // Load printable models for actual editing
            if (window.__DEV__) console.log('加载可打印模型...');
            this.printableModels = {
                part1: await this.loadModel('./assets/Part_1_Printable.glb'),
                part2: await this.loadModel('./assets/Part_2_Printable.glb'), 
                part3: await this.loadModel('./assets/Part_3_Printable_Source.glb')
            };
            
            if (window.__DEV__) console.log('All models loaded successfully');
            
            // Use display model for preview
            const model = displayModel;
            if (window.__DEV__) console.log('Successfully loaded GLB model: Dizi_Display.glb');
            
            // Debug: Comprehensive material and mesh analysis
            if (window.__DEV__) console.log('Comprehensive GLB model analysis:');
            const materials = [];
            const meshes = [];
            
            model.traverse((child) => {
                if (child.isMesh) {
                    const meshName = child.name || 'unnamed_mesh';
                    const materialName = child.material?.name || 'unnamed_material';
                    
                    meshes.push(meshName);
                    materials.push(materialName);
                    
                    if (window.__DEV__) console.log(`Mesh: "${meshName}" | Material: "${materialName}"`);
                    
                    // Check for potential customization areas
                    if (materialName.toLowerCase().includes('custom') || 
                        materialName.toLowerCase().includes('text') || 
                        materialName.toLowerCase().includes('image') ||
                        materialName.toLowerCase().includes('engraving') ||
                        meshName.toLowerCase().includes('custom') ||
                        meshName.toLowerCase().includes('text') ||
                        meshName.toLowerCase().includes('image')) {
                        if (window.__DEV__) console.log(`POTENTIAL CUSTOMIZATION AREA: ${meshName} / ${materialName}`);
                    }
                }
            });
            
            if (window.__DEV__) console.log('GLB Model Summary:');
            if (window.__DEV__) console.log(`   - Meshes found: ${meshes.length}`);
            if (window.__DEV__) console.log(`   - Materials found: ${materials.length}`);
            if (window.__DEV__) console.log(`   - Unique materials: ${[...new Set(materials)].join(', ')}`);
            if (window.__DEV__) console.log(`   - Unique meshes: ${[...new Set(meshes)].join(', ')}`);
            
            // Trigger the onReady callback
            if (this.onReady) {
                if (window.__DEV__) console.log('Triggering onReady callback');
                setTimeout(() => this.onReady(), 100);
            }
            
        } catch (glbError) {
            if (window.__DEV__) console.error('CRITICAL: Failed to load GLB model:', glbError);
            if (window.__DEV__) console.error('Error details:', {
                message: glbError.message,
                stack: glbError.stack
            });
            
            // DO NOT CREATE PLACEHOLDER - Show error instead
            if (window.__DEV__) console.error('CANNOT LOAD GLB MODEL - STOPPING HERE');
            
            // Trigger onReady callback even if model loading failed
            // This prevents the app from getting stuck in loading state
            if (this.onReady) {
                if (window.__DEV__) console.log('Triggering onReady callback after error (to prevent stuck loading)');
                setTimeout(() => this.onReady(), 100);
            }
            
            throw new Error('GLB model loading failed - no fallback available');
        }
    }

    /**
     * Create a detailed bamboo flute model
     */
    createBambooFluteModel() {
        if (window.__DEV__) console.log('🎋 Creating detailed placeholder bamboo flute model...');
        
        const group = new THREE.Group();

        // Create bamboo texture pattern
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Bamboo base color
        const gradient = ctx.createLinearGradient(0, 0, 0, 64);
        gradient.addColorStop(0, '#E6C2A6');
        gradient.addColorStop(0.5, '#D4A574');
        gradient.addColorStop(1, '#B8956F');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 64);
        
        // Add bamboo segments (�?
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            const x = i * 85 + 40;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 64);
            ctx.stroke();
        }
        
        const bambooTexture = new THREE.CanvasTexture(canvas);
        bambooTexture.wrapS = THREE.RepeatWrapping;
        bambooTexture.repeat.x = 2;

        // Main bamboo cylinder (horizontal, like a real flute)  
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 8, 32);  // More reasonable size to prevent clipping
        const material = new THREE.MeshPhongMaterial({
            map: bambooTexture,
            color: 0xFFFFFF,
            shininess: 30,
            specular: 0x444444,  // More specular highlights
            name: 'MainBamboo'  // Add material name for texture application
        });

        const bamboo = new THREE.Mesh(geometry, material);
        bamboo.castShadow = true;
        bamboo.receiveShadow = true;
        
        // Rotate to horizontal position (like a flute)
        bamboo.rotation.z = Math.PI / 2;
        bamboo.name = 'MainBody';
        
        group.add(bamboo);

        // Add finger holes with more detail
        const holeGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16);
        const holeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x1A1A1A,
            shininess: 0
        });

        // Finger hole positions (more accurate to real dizi)
        const fingerHoles = [
            { x: -3.5, y: 0, z: 0.38, name: 'hole1' },
            { x: -2.5, y: 0, z: 0.38, name: 'hole2' },
            { x: -1.5, y: 0, z: 0.38, name: 'hole3' },
            { x: -0.5, y: 0, z: 0.38, name: 'hole4' },
            { x: 0.5, y: 0, z: 0.38, name: 'hole5' },
            { x: 1.5, y: 0, z: 0.38, name: 'hole6' }
        ];

        fingerHoles.forEach((pos) => {
            const hole = new THREE.Mesh(holeGeometry, holeMaterial);
            hole.position.set(pos.x, pos.y, pos.z);
            hole.rotation.x = Math.PI / 2;
            hole.name = pos.name;
            group.add(hole);
        });

        // Add blow hole (different position and size)
        const blowHoleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16);
        const blowHole = new THREE.Mesh(blowHoleGeometry, holeMaterial);
        blowHole.position.set(-4.5, 0, 0.38);
        blowHole.rotation.x = Math.PI / 2;
        blowHole.name = 'blowHole';
        group.add(blowHole);

        // Add membrane hole (dizi特有的膜�?
        const membraneHole = new THREE.Mesh(holeGeometry, holeMaterial);
        membraneHole.position.set(-4.0, 0, 0.38);
        membraneHole.rotation.x = Math.PI / 2;
        membraneHole.name = 'membraneHole';
        group.add(membraneHole);

        // Add decorative end caps
        const capGeometry = new THREE.CylinderGeometry(0.25, 0.35, 0.3, 16);
        const capMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x654321,
            shininess: 40
        });
        
        const leftCap = new THREE.Mesh(capGeometry, capMaterial);
        leftCap.position.set(-5.2, 0, 0);
        leftCap.rotation.z = Math.PI / 2;
        leftCap.name = 'leftCap';
        group.add(leftCap);
        
        const rightCap = new THREE.Mesh(capGeometry, capMaterial);
        rightCap.position.set(5.2, 0, 0);
        rightCap.rotation.z = Math.PI / 2;
        rightCap.name = 'rightCap';
        group.add(rightCap);

        // Add Chinese characters or decorative elements
        const textCanvas = document.createElement('canvas');
        textCanvas.width = 256;
        textCanvas.height = 64;
        const textCtx = textCanvas.getContext('2d');
        textCtx.fillStyle = '#8B4513';
        textCtx.font = '24px serif';
        textCtx.textAlign = 'center';
        textCtx.fillText('竹笛', 128, 40);
        
        const textTexture = new THREE.CanvasTexture(textCanvas);
        const textMaterial = new THREE.MeshPhongMaterial({
            map: textTexture,
            transparent: true,
            opacity: 0.7,
            name: 'DecorativeText'
        });
        
        const textPlane = new THREE.PlaneGeometry(2, 0.5);
        const textMesh = new THREE.Mesh(textPlane, textMaterial);
        textMesh.position.set(2, 0, 0.4);
        textMesh.name = 'decorativeText';
        group.add(textMesh);

        // Add custom texture application areas
        // Slightly curved text area to avoid being inside geometry and improve readability
        const customTextArea = new THREE.PlaneGeometry(3, 1, 16, 1);
        const customTextMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,  // White base for better color application
            transparent: false,
            opacity: 1.0,
            name: 'Custom_Area_Text'  // Special name for text texture targeting
        });
        const textAreaMesh = new THREE.Mesh(customTextArea, customTextMaterial);
        // Bend the plane slightly along X to match cylinder surface
        const bendAmount = 0.02;
        textAreaMesh.geometry.vertices?.forEach(v => { v.z += Math.sin(v.x) * bendAmount; });
        textAreaMesh.position.set(-1, 0, 0.43); // lift a bit to avoid z-fighting
        textAreaMesh.name = 'CustomTextArea';
        group.add(textAreaMesh);

        const customImageArea = new THREE.PlaneGeometry(2.5, 0.8);
        const customImageMaterial = new THREE.MeshPhongMaterial({
            color: 0xD4A574,
            transparent: true,
            opacity: 0.8,
            name: 'Custom_Area_Image'  // Special name for image texture targeting
        });
        const imageAreaMesh = new THREE.Mesh(customImageArea, customImageMaterial);
        imageAreaMesh.position.set(1.5, 0, 0.42);
        imageAreaMesh.name = 'CustomImageArea';
        group.add(imageAreaMesh);

        // Add a subtle glow effect
        const glowGeometry = new THREE.CylinderGeometry(0.38, 0.38, 10.2, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFE4B5,
            transparent: true,
            opacity: 0.1
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.rotation.z = Math.PI / 2;
        glow.name = 'glow';
        group.add(glow);

        group.name = 'DetailedBambooFlute';
        if (window.__DEV__) console.log('Detailed bamboo flute model created with texture and details');
        return group;
    }

    /**
     * Main animation/render loop
     */
    animate = () => {
        if (!this.isAnimating) {
            requestAnimationFrame(this.animate);
            return;
        }

        requestAnimationFrame(this.animate);

        const deltaTime = this.clock.getDelta();

        // Update stats
        if (this.stats) {
            this.stats.update();
        }

        // Update performance metrics
        this.updatePerformanceMetrics(deltaTime);

        // Controls disabled for guided customization mode

        // Update animations
        if (this.animationMixer) {
            this.animationMixer.update(deltaTime);
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(deltaTime) {
        this.frameTime = deltaTime * 1000; // Convert to milliseconds
        this.fps = Math.round(1 / deltaTime);

        // Update performance overlay
        if (this.performanceOverlay) {
            this.performanceOverlay.innerHTML = `
                <div>FPS: ${this.fps}</div>
                <div>Frame Time: ${this.frameTime.toFixed(2)}ms</div>
                <div>Objects: ${this.scene.children.length}</div>
                <div>Triangles: ${this.renderer.info.render.triangles}</div>
            `;
        }
    }

    /**
     * Create performance overlay
     */
    createPerformanceOverlay() {
        if (!this.options.enableStats) return;
        
        const container = document.getElementById('stats-container');
        if (!container) return;

        this.performanceOverlay = document.createElement('div');
        this.performanceOverlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 1000;
        `;

        container.appendChild(this.performanceOverlay);
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        // Use setTimeout to ensure layout has settled
        setTimeout(() => {
            const width = this.container.clientWidth || window.innerWidth;
            const height = this.container.clientHeight || window.innerHeight;

            // Validate dimensions
            if (width <= 0 || height <= 0) {
                if (window.__DEV__) console.warn('Invalid viewport dimensions, skipping resize');
                return;
            }

            if (window.__DEV__) console.log(`调整3D视口大小: ${width}x${height}`);

            // Update camera aspect ratio
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            // Update orthographic camera
            const frustumSize = 10;
            this.orthographicCamera.left = frustumSize * width / height / -2;
            this.orthographicCamera.right = frustumSize * width / height / 2;
            this.orthographicCamera.updateProjectionMatrix();

            // Update renderer size with forced recalculation
            this.renderer.setSize(width, height, true);
            
            // Ensure canvas maintains proper styling
            if (this.renderer.domElement) {
                this.renderer.domElement.style.width = '100%';
                this.renderer.domElement.style.height = '100%';
                this.renderer.domElement.style.display = 'block';
                this.renderer.domElement.style.objectFit = 'contain';
            }

            // Force a render to show the changes immediately
            if (this.camera && this.scene) {
                this.renderer.render(this.scene, this.camera);
            }
        }, 100);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Toggle debug mode
        if (event.key === 'd' && event.ctrlKey) {
            event.preventDefault();
            this.toggleDebugMode();
        }

        // Toggle wireframe mode
        if (event.key === 'w' && event.ctrlKey) {
            event.preventDefault();
            this.toggleWireframeMode();
        }

        // Reset camera
        if (event.key === 'r' && event.ctrlKey) {
            event.preventDefault();
            this.resetCamera();
        }

        // Toggle auto-rotate
        if (event.key === 'a' && event.ctrlKey) {
            event.preventDefault();
            this.toggleAutoRotate();
        }
    }

    /**
     * Load 3D model
     * @param {Object|String} model - Model object or URL
     * @param {Object} options - Loading options
     */
    async loadModel(model, options = {}) {
        try {
            let loadedModel;

            if (typeof model === 'string') {
                // Load from URL
                loadedModel = await this.loadModelFromURL(model, options);
            } else if (model.isObject3D) {
                // Direct Three.js object
                loadedModel = model;
            } else {
                throw new Error('Invalid model format');
            }

            // Remove current model
            if (this.currentModel) {
                this.scene.remove(this.currentModel);
            }

            // Add new model to scene
            this.currentModel = loadedModel;
            this.scene.add(loadedModel);

            // Setup model properties
            this.setupModel(loadedModel, options);

            // Center and frame model
            this.centerAndFrameModel(loadedModel);

            return loadedModel;

        } catch (error) {
            if (window.__DEV__) console.error('Failed to load model:', error);
            throw error;
        }
    }

    /**
     * Load model from URL
     */
    async loadModelFromURL(url, options = {}) {
        if (window.__DEV__) console.log(`从URL加载模型: ${url}`);
        
        // Check if file exists first
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Model file not accessible: ${response.status} ${response.statusText}`);
            }
            if (window.__DEV__) console.log(`Model file exists: ${url} (${response.headers.get('content-length')} bytes)`);
        } catch (error) {
            if (window.__DEV__) console.error(`Model file check failed: ${error.message}`);
            throw error;
        }

        // Check cache first
        if (this.modelCache.has(url)) {
            if (window.__DEV__) console.log(`📦 Loading model from cache: ${url}`);
            return this.modelCache.get(url).clone();
        }

        return new Promise((resolve, reject) => {
            if (window.__DEV__) console.log(`启动GLTF加载器: ${url}`);
            
            // Ensure GLTFLoader is available
            if (typeof THREE.GLTFLoader === 'undefined') {
                reject(new Error('GLTFLoader not available. Check script loading.'));
                return;
            }
            
            const loader = new THREE.GLTFLoader();
            
            // Add timeout to prevent infinite loading
            const timeout = setTimeout(() => {
                reject(new Error(`Model loading timeout after 30 seconds: ${url}`));
            }, 30000);

            loader.load(
                url,
                (gltf) => {
                    clearTimeout(timeout);
                    if (window.__DEV__) console.log(`GLTF loaded successfully:`, gltf);
                    const model = gltf.scene;

                    if (!model || model.children.length === 0) {
                        if (window.__DEV__) console.warn(`Model loaded but appears empty:`, model);
                    }

                    // Log model details
                    if (window.__DEV__) console.log(`Model info:`, {
                        children: model.children.length,
                        animations: gltf.animations?.length || 0,
                        materials: gltf.materials?.length || 0,
                        textures: gltf.textures?.length || 0
                    });

                    // Process animations
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.animationMixer = new THREE.AnimationMixer(model);
                        this.animations = gltf.animations;

                        // Play first animation by default
                        const action = this.animationMixer.clipAction(gltf.animations[0]);
                        action.play();
                        if (window.__DEV__) console.log(`🎬 Animation started: ${gltf.animations[0].name}`);
                    }

                    // Cache model
                    this.modelCache.set(url, model.clone());
                    if (window.__DEV__) console.log(`💾 Model cached: ${url}`);

                    resolve(model);
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total * 100).toFixed(1);
                    if (window.__DEV__) console.log(`📈 Loading progress: ${percent}% (${progress.loaded}/${progress.total})`);
                    
                    // Update UI loading text (if available)
                    // Note: UI is handled by the parent App class
                    
                    if (options.onProgress) {
                        options.onProgress(progress);
                    }
                },
                (error) => {
                    clearTimeout(timeout);
                    if (window.__DEV__) console.error(`💥 GLTF loading failed:`, error);
                    if (window.__DEV__) console.error(`Failed URL: ${url}`);
                    reject(error);
                }
            );
        });
    }

    /**
     * Setup model properties
     */
    setupModel(model, options) {
        // Setup shadows
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Optimize geometry
                if (child.geometry) {
                    child.geometry.computeVertexNormals();
                }
            }
        });

        // Apply material optimizations
        if (options.optimizeMaterials !== false) {
            this.optimizeModelMaterials(model);
        }

        // Setup LOD if enabled
        if (this.options.enableLOD) {
            this.setupModelLOD(model);
        }
    }

    /**
     * Optimize model materials
     */
    optimizeModelMaterials(model) {
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                const material = child.material;

                // Enable material optimizations
                if (material.map) {
                    material.map.anisotropy = 4;
                }

                if (material.normalMap) {
                    material.normalMap.anisotropy = 4;
                }

                // Reduce material complexity on mobile
                if (this.isMobile()) {
                    material.flatShading = true;
                }
            }
        });
    }

    /**
     * Setup model Level of Detail (LOD)
     */
    setupModelLOD(model) {
        // Implementation for LOD system
        // This would create simplified versions of the model
        // based on camera distance
    }

    /**
     * Center and frame model based on accurate Blender data
     * Model: 25m x 25m x 642m, with pivot offset ~1/3 from head (Y+ direction)
     * After 90° X rotation: length extends along Y-axis
     */
    centerAndFrameModel(model) {
        if (window.__DEV__) console.log('Centering model using accurate Blender specifications...');
        if (window.__DEV__) console.log('Expected model: 25m x 25m x 642m with pivot offset');
        
        // Calculate bounding box to understand actual loaded geometry
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        if (window.__DEV__) console.log('Loaded model analysis:');
        if (window.__DEV__) console.log('  - Bounding box center:', center.toArray());
        if (window.__DEV__) console.log('  - Dimensions:', size.toArray());
        if (window.__DEV__) console.log('  - Model pivot (original position):', model.position.toArray());

        // Convert expected Blender dimensions to Three.js scale
        const expectedLength = 642; // meters along Y-axis after rotation
        const actualLength = Math.max(size.x, size.y, size.z);
        
        if (window.__DEV__) console.log(`📏 Scale analysis: expected=${expectedLength}m, actual=${actualLength.toFixed(2)}m`);

        // Handle potential scale mismatch between Blender export and Three.js import
        let scaleFactor = 1;
        if (actualLength > 100) {
            // Model is in meters, reduce to reasonable size for display
            scaleFactor = 10 / actualLength; // Scale to 10 units for better handling
            model.scale.setScalar(scaleFactor);
            if (window.__DEV__) console.log(`🔧 Applied scale factor: ${scaleFactor.toFixed(4)} (${actualLength.toFixed(2)}m ≈${(actualLength * scaleFactor).toFixed(2)} units)`);
            
            // Recalculate after scaling
            box.setFromObject(model);
            center.copy(box.getCenter(new THREE.Vector3()));
            size.copy(box.getSize(new THREE.Vector3()));
        }

        // Center the geometric center at world origin
        // Account for the fact that Blender pivot is offset from geometric center
        model.position.set(-center.x, -center.y, -center.z);
        
        if (window.__DEV__) console.log('Model centered:');
        if (window.__DEV__) console.log('  - Translation applied:', [-center.x, -center.y, -center.z]);
        if (window.__DEV__) console.log('  - Final dimensions:', size.toArray());
        if (window.__DEV__) console.log('  - Scale factor:', scaleFactor);

        // Update camera positions based on actual model size
        this.updateCameraForModelSize(size, scaleFactor);

        // Initialize 360-degree rotation camera system
        this.initializeRotationCamera();
        
        // Add keyboard controls for camera rotation
        this.addKeyboardControls();

        // Debug visualization removed for cleaner display
        // this.addModelDebugMarkers(size);
        
        if (window.__DEV__) console.log('📍 Model centering complete - ready for customization');
    }

    /**
     * Update camera blueprint based on actual model size
     */
    updateCameraForModelSize(modelSize, scaleFactor) {
        const maxDimension = Math.max(modelSize.x, modelSize.y, modelSize.z);
        const optimalDistance = maxDimension * 3; // Camera distance for good framing
        const sideDistance = maxDimension * 1.5;  // Side positioning
        
        // Update camera configuration dynamically
        this.camera.far = optimalDistance * 5;
        this.camera.updateProjectionMatrix();
        
        if (window.__DEV__) console.log(`Camera updated for model size:
  - Max dimension: ${maxDimension.toFixed(2)} units  
  - Optimal distance: ${optimalDistance.toFixed(2)} units
  - Far clipping: ${this.camera.far.toFixed(2)} units`);
        
        // Position camera at optimal distance
        this.camera.position.set(sideDistance, optimalDistance * 0.3, optimalDistance * 0.7);
        
        // CRITICAL: Since camera is in a rotated group, we need to set the target correctly
        // The model is at world origin (0,0,0), but we need to account for group rotation
        this.camera.lookAt(0, 0, 0);
        
        // Force update the camera matrices
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld();
        
        if (window.__DEV__) console.log('Camera positioned at:', this.camera.position.toArray());
        if (window.__DEV__) console.log('Camera target: (0, 0, 0) - model center');
    }

    /**
     * Add debug markers to visualize model structure
     */
    addModelDebugMarkers(modelSize) {
        if (!this.options.enableDebug) return;
        
        const axesHelper = new THREE.AxesHelper(modelSize.y * 0.1);
        axesHelper.name = 'ModelCenterAxes';
        this.scene.add(axesHelper);
        
        const boxGeometry = new THREE.BoxGeometry(modelSize.x, modelSize.y, modelSize.z);
        const boxMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3 
        });
        const boundingBox = new THREE.Mesh(boxGeometry, boxMaterial);
        boundingBox.name = 'ModelBoundingBox';
        this.scene.add(boundingBox);
        
        if (window.__DEV__) console.log('🔍 Debug markers added');
    }

    /**
     * Switch between perspective and orthographic camera
     */
    switchCamera(type = 'perspective') {
        if (type === 'orthographic') {
            this.camera = this.orthographicCamera;
        } else {
            this.camera = this.perspectiveCamera;
        }

        // Controls disabled for guided customization
    }

    /**
     * Reset camera to default position
     */
    resetCamera() {
        this.camera.position.set(
            this.options.cameraPosition.x,
            this.options.cameraPosition.y,
            this.options.cameraPosition.z
        );
        this.camera.lookAt(0, 0, 0);

        // Controls disabled for guided customization
    }

    /**
     * Update camera position based on current angles
     */
    updateCameraPosition() {
        // Convert angles to radians
        const horizontalRad = THREE.MathUtils.degToRad(this.rotationState.currentAngle);
        const elevationRad = THREE.MathUtils.degToRad(this.rotationState.currentElevation);
        
        // Calculate position using spherical coordinates
        const horizontalRadius = this.rotationState.radius * Math.cos(elevationRad);
        const newX = Math.sin(horizontalRad) * horizontalRadius;
        const newZ = Math.cos(horizontalRad) * horizontalRadius;
        const newY = Math.sin(elevationRad) * this.rotationState.radius;
        
        // Set camera position and look at model center
        this.camera.position.set(newX, newY, newZ);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Start continuous rotation
     * @param {string} direction - 'left', 'right', 'up', 'down'
     */
    startContinuousRotation(direction) {
        this.stopContinuousRotation(); // Stop any existing rotation
        
        const isHorizontal = direction === 'left' || direction === 'right';
        const isVertical = direction === 'up' || direction === 'down';
        
        if (isHorizontal) {
            const rotationDirection = direction === 'left' ? 1 : -1;
            this.rotationState.rotationInterval = setInterval(() => {
                this.rotationState.currentAngle += this.rotationState.rotationSpeed * rotationDirection;
                
                // Keep angle in 0-360 range
                if (this.rotationState.currentAngle < 0) {
                    this.rotationState.currentAngle += 360;
                } else if (this.rotationState.currentAngle >= 360) {
                    this.rotationState.currentAngle -= 360;
                }
                
                this.updateCameraPosition();
            }, 16); // ~60fps
            
            if (window.__DEV__) console.log(`开始连续水平旋转: ${direction}`);
        }
        
        if (isVertical) {
            const elevationDirection = direction === 'up' ? 1 : -1;
            this.rotationState.elevationInterval = setInterval(() => {
                const newElevation = this.rotationState.currentElevation + 
                                   this.rotationState.elevationSpeed * elevationDirection;
                
                // No elevation limits - allow full 360 degree rotation
                this.rotationState.currentElevation = newElevation;
                
                // Normalize elevation angle to keep it within reasonable range
                if (this.rotationState.currentElevation <= -360) {
                    this.rotationState.currentElevation += 360;
                } else if (this.rotationState.currentElevation >= 360) {
                    this.rotationState.currentElevation -= 360;
                }
                
                this.updateCameraPosition();
            }, 16); // ~60fps
            
            if (window.__DEV__) console.log(`开始连续垂直旋转: ${direction}`);
        }
    }

    /**
     * Stop continuous rotation
     */
    stopContinuousRotation() {
        if (this.rotationState.rotationInterval) {
            clearInterval(this.rotationState.rotationInterval);
            this.rotationState.rotationInterval = null;
            if (window.__DEV__) console.log('Stopped horizontal rotation');
        }
        
        if (this.rotationState.elevationInterval) {
            clearInterval(this.rotationState.elevationInterval);
            this.rotationState.elevationInterval = null;
            if (window.__DEV__) console.log('Stopped vertical rotation');
        }
    }

    /**
     * Single step rotation (for single clicks)
     * @param {string} direction - 'left', 'right', 'up', 'down'
     */
    rotateCameraStep(direction) {
        const isHorizontal = direction === 'left' || direction === 'right';
        const isVertical = direction === 'up' || direction === 'down';
        
        if (isHorizontal) {
            const rotationDirection = direction === 'left' ? 1 : -1;
            this.rotationState.currentAngle += this.rotationState.rotationSpeed * rotationDirection * 5; // Bigger step for single click
            
            // Keep angle in 0-360 range
            if (this.rotationState.currentAngle < 0) {
                this.rotationState.currentAngle += 360;
            } else if (this.rotationState.currentAngle >= 360) {
                this.rotationState.currentAngle -= 360;
            }
        }
        
        if (isVertical) {
            const elevationDirection = direction === 'up' ? 1 : -1;
            const newElevation = this.rotationState.currentElevation + 
                               this.rotationState.elevationSpeed * elevationDirection * 5; // Bigger step for single click
            
            // No elevation limits - allow full 360 degree rotation
            this.rotationState.currentElevation = newElevation;
        }
        
        this.updateCameraPosition();
        if (window.__DEV__) console.log(`单步旋转: ${direction} (水平: ${this.rotationState.currentAngle.toFixed(1)}°, 垂直: ${this.rotationState.currentElevation.toFixed(1)}°)`);
    }
    
    /**
     * Initialize camera for 360-degree rotation around model
     */
    initializeRotationCamera() {
        if (!this.currentModel) {
            if (window.__DEV__) console.warn('No model loaded, cannot initialize rotation camera');
            return;
        }
        
        // Calculate optimal distance based on model size
        if (this.modelSize) {
            const maxDimension = Math.max(this.modelSize.x, this.modelSize.y, this.modelSize.z);
            this.rotationState.radius = maxDimension * 3; // Distance for good viewing
        }
        
        // Set initial camera angles (front view, slightly elevated)
        this.rotationState.currentAngle = 0;        // Looking at front
        this.rotationState.currentElevation = 15;   // Slightly above model
        
        // Update camera position using new angle system
        this.updateCameraPosition();
        
        if (window.__DEV__) console.log(`🎥 Dual-axis rotation camera initialized:`);
        if (window.__DEV__) console.log(`  Radius: ${this.rotationState.radius.toFixed(2)}`);
        if (window.__DEV__) console.log(`  Horizontal angle: ${this.rotationState.currentAngle}°`);
        if (window.__DEV__) console.log(`  Elevation angle: ${this.rotationState.currentElevation}°`);
        if (window.__DEV__) console.log(`  Elevation range: ${this.rotationState.minElevation}° to ${this.rotationState.maxElevation}°`);
    }
    
    /**
     * Add keyboard controls for camera rotation
     */
    addKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            // Prevent rotation if user is typing in an input field
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch(event.key.toLowerCase()) {
                case 'a':
                case 'arrowleft':
                    event.preventDefault();
                    this.startContinuousRotation('left');
                    break;
                case 'd':
                case 'arrowright':
                    event.preventDefault();
                    this.startContinuousRotation('right');
                    break;
                case 'w':
                case 'arrowup':
                    event.preventDefault();
                    this.startContinuousRotation('up');
                    break;
                case 's':
                case 'arrowdown':
                    event.preventDefault();
                    this.startContinuousRotation('down');
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            // Stop rotation when key is released
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch(event.key.toLowerCase()) {
                case 'a':
                case 'arrowleft':
                case 'd':
                case 'arrowright':
                case 'w':
                case 'arrowup':
                case 's':
                case 'arrowdown':
                    event.preventDefault();
                    this.stopContinuousRotation();
                    break;
            }
        });
        
        if (window.__DEV__) console.log('Keyboard camera controls activated: WASD / Arrow keys');
    }

    /**
     * Toggle auto-rotation
     */
    toggleAutoRotate() {
        this.controls.autoRotate = !this.controls.autoRotate;
    }

    /**
     * Toggle debug mode
     */
    toggleDebugMode() {
        this.debugMode = !this.debugMode;

        if (this.debugHelpers) {
            const visible = this.debugMode;

            if (this.debugHelpers.grid) {
                this.debugHelpers.grid.visible = visible;
            }

            if (this.debugHelpers.axes) {
                this.debugHelpers.axes.visible = visible;
            }

            this.debugHelpers.lights.forEach(helper => {
                helper.visible = visible;
            });
        }
    }

    /**
     * Toggle wireframe mode
     */
    toggleWireframeMode() {
        this.wireframeMode = !this.wireframeMode;

        this.scene.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.wireframe = this.wireframeMode;
                    });
                } else {
                    child.material.wireframe = this.wireframeMode;
                }
            }
        });
    }

    /**
     * Export scene as GLTF - DEPRECATED
     * Export functionality moved to Customizer for unified management
     */
    async exportGLTF() {
        throw new Error('Export functionality moved to Customizer. Use customizer.exportModel() instead.');
    }

    /**
     * Optimize scene for export by removing debug objects
     */
    optimizeExportScene(scene) {
        const objectsToRemove = [];
        
        scene.traverse((child) => {
            // Remove debug helpers
            if (child.name?.includes('Helper') || 
                child.name?.includes('Debug') ||
                child.name?.includes('Marker') ||
                child.name?.includes('Axes')) {
                objectsToRemove.push(child);
            }
        });
        
        objectsToRemove.forEach(obj => {
            if (obj.parent) {
                obj.parent.remove(obj);
            }
        });
        
        if (window.__DEV__) console.log(`移除了${objectsToRemove.length}个调试对象从导出场景`);
    }

    /**
     * Get export-ready model with applied customizations
     * Returns a clean model ready for manufacturing
     */
    getExportReadyModel() {
        if (!this.currentModel) {
            return null;
        }
        
        // Clone the current model
        const exportModel = this.currentModel.clone();
        
        // Ensure all materials are properly configured for export
        exportModel.traverse((child) => {
            if (child.isMesh && child.material) {
                // Ensure textures have proper settings
                if (child.material.map) {
                    child.material.map.flipY = false; // Important for consistent export
                    child.material.map.generateMipmaps = false; // Reduce file size
                }
                
                // Ensure material is ready for export
                child.material.needsUpdate = true;
            }
        });
        
        return exportModel;
    }

    /**
     * Take screenshot
     */
    takeScreenshot(options = {}) {
        const screenshotOptions = {
            format: 'image/png',
            quality: 1.0,
            ...options
        };

        return this.renderer.domElement.toDataURL(
            screenshotOptions.format,
            screenshotOptions.quality
        );
    }

    /**
     * Check if running on mobile device
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    }

    /**
     * Get scene statistics
     */
    getSceneStats() {
        return {
            fps: this.fps,
            frameTime: this.frameTime,
            memory: this.memory,
            objects: this.scene.children.length,
            triangles: this.renderer.info.render.triangles,
            drawCalls: this.renderer.info.render.calls,
            textures: this.renderer.info.memory.textures,
            geometries: this.renderer.info.memory.geometries
        };
    }

    /**
     * Optimize performance
     */
    optimizePerformance() {
        // Reduce texture quality on mobile
        if (this.isMobile()) {
            this.renderer.setPixelRatio(1);
        }

        // Disable shadows on low-end devices
        if (this.fps < 30) {
            this.renderer.shadowMap.enabled = false;
        }

        // Reduce lighting complexity
        if (this.fps < 20) {
            this.lights.point.intensity = 0.3;
            this.lights.hemisphere.intensity = 0.1;
        }
    }

    /**
     * Dispose of resources and cleanup
     */
    dispose() {
        // Stop animation loop
        this.isAnimating = false;

        // Remove renderer
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }

        // Clear model cache
        this.modelCache.clear();

        // Remove event listeners
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        if (this._onVisibility) document.removeEventListener('visibilitychange', this._onVisibility);
        if (this._resizeIntervalId) clearInterval(this._resizeIntervalId);
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);

        // Dispose of controls
        if (this.controls) {
            this.controls.dispose();
        }

        // Clear scene
        if (this.scene) {
            while (this.scene.children.length > 0) {
                const object = this.scene.children[0];
                this.scene.remove(object);
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => mat.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
        }
    }

    /**
     * Get current camera position
     */
    getCameraPosition() {
        return {
            position: this.camera.position.clone(),
            target: this.controls.target.clone()
        };
    }

    /**
     * Set camera position
     */
    setCameraPosition(position, target) {
        if (position) {
            this.camera.position.copy(position);
        }
        if (target) {
            // Controls disabled
        }
    }

    /**
     * Add object to scene
     */
    addObject(object, name = null) {
        if (name) {
            this.sceneObjects.set(name, object);
        }
        this.scene.add(object);
    }

    /**
     * Remove object from scene
     */
    removeObject(name) {
        const object = this.sceneObjects.get(name);
        if (object) {
            this.scene.remove(object);
            this.sceneObjects.delete(name);
        }
    }

    /**
     * Get object from scene
     */
    getObject(name) {
        return this.sceneObjects.get(name);
    }

    /**
     * Update lighting settings
     */
    updateLighting(settings = {}) {
        if (settings.ambient !== undefined) {
            this.lights.ambient.intensity = settings.ambient;
        }
        if (settings.directional !== undefined) {
            this.lights.directional.intensity = settings.directional;
        }
        if (settings.point !== undefined) {
            this.lights.point.intensity = settings.point;
        }
        if (settings.hemisphere !== undefined) {
            this.lights.hemisphere.intensity = settings.hemisphere;
        }
    }

    /**
     * Set background color
     */
    setBackgroundColor(color) {
        this.scene.background = new THREE.Color(color);
    }

    /**
     * Set fog settings
     */
    setFog(color, near, far) {
        this.scene.fog = new THREE.Fog(color, near, far);
    }

    /**
     * Play animation by name or index
     */
    playAnimation(nameOrIndex) {
        if (!this.animationMixer || !this.animations.length) return;

        let clip;
        if (typeof nameOrIndex === 'string') {
            clip = this.animations.find(a => a.name === nameOrIndex);
        } else {
            clip = this.animations[nameOrIndex];
        }

        if (clip) {
            const action = this.animationMixer.clipAction(clip);
            action.reset().play();
        }
    }

    /**
     * Stop all animations
     */
    stopAnimations() {
        if (this.animationMixer) {
            this.animationMixer.stopAllAction();
        }
    }

    /**
     * Set animation speed
     */
    setAnimationSpeed(speed) {
        if (this.animationMixer) {
            this.animationMixer.timeScale = speed;
        }
    }
}
