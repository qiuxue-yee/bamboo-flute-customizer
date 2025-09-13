// 性能优化的3D应用示例
class PerformanceOptimizedApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.memoryOptimizer = null;
        this.gpuOptimizer = null;
        this.animationOptimizer = null;
        this.mobileOptimizer = null;
        this.stats = null;
        this.animationId = null;

        // 性能指标
        this.performanceMetrics = {
            fps: 60,
            frameTime: 16,
            memoryUsage: 0,
            drawCalls: 0,
            triangles: 0
        };

        // 初始化
        this.init();
    }

    // 初始化
    init() {
        // 创建场景
        this.createScene();

        // 创建相机
        this.createCamera();

        // 创建优化的渲染器
        this.createOptimizedRenderer();

        // 创建控制器
        this.createControls();

        // 创建光照
        this.createLights();

        // 初始化优化器
        this.initializeOptimizers();

        // 加载模型
        this.loadModels();

        // 设置事件监听
        this.setupEventListeners();

        // 开始渲染循环
        this.startRenderLoop();

        // 初始化完成
        console.log('性能优化的3D应用已初始化');
    }

    // 创建场景
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f2f5);
        this.scene.fog = new THREE.Fog(0xf0f2f5, 100, 1000);
        this.scene.autoUpdate = false;
    }

    // 创建相机
    createCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 300);
        this.camera.lookAt(0, 0, 0);
        this.camera.matrixAutoUpdate = false;
    }

    // 创建优化的渲染器
    createOptimizedRenderer() {
        this.renderer = ThreeOptimizedUtils.createOptimizedRenderer({
            antialias: !this.isMobile(),
            alpha: false
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    }

    // 创建控制器
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 500;
    }

    // 创建光照
    createLights() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // 主光源
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(100, 100, 100);
        mainLight.castShadow = !this.isMobile();

        if (!this.isMobile()) {
            mainLight.shadow.camera.near = 0.1;
            mainLight.shadow.camera.far = 500;
            mainLight.shadow.camera.left = -100;
            mainLight.shadow.camera.right = 100;
            mainLight.shadow.camera.top = 100;
            mainLight.shadow.camera.bottom = -100;
            mainLight.shadow.mapSize.width = 1024;
            mainLight.shadow.mapSize.height = 1024;
        }

        this.scene.add(mainLight);

        // 补充光源
        const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3);
        this.scene.add(hemiLight);
    }

    // 初始化优化器
    initializeOptimizers() {
        // 内存优化器
        this.memoryOptimizer = new MemoryOptimizer(this.renderer, this.scene);
        this.memoryOptimizer.startPeriodicCleanup();

        // GPU优化器
        this.gpuOptimizer = new GPUOptimizer(this.renderer, this.scene);

        // 动画优化器
        this.animationOptimizer = new AnimationOptimizer();

        // 移动端优化器
        this.mobileOptimizer = new MobileOptimizer(this.renderer, this.scene, this.camera);

        // 性能监控
        this.setupPerformanceMonitoring();
    }

    // 设置性能监控
    setupPerformanceMonitoring() {
        // Stats.js
        this.stats = new Stats();
        this.stats.showPanel(0);
        document.getElementById('stats-container').appendChild(this.stats.dom);

        // 性能分析器
        this.performanceAnalyzer = ThreeOptimizedUtils.createPerformanceAnalyzer();
        this.performanceAnalyzer.start();
    }

    // 加载模型
    loadModels() {
        const loader = new THREE.GLTFLoader();

        // 使用预加载管理器
        const preloadManager = ThreeOptimizedUtils.createPreloadManager();

        // 加载主模型
        preloadManager.add(
            () => new Promise((resolve, reject) => {
                loader.load(
                    'assets/Dizi_Display.glb',
                    (gltf) => {
                        this.optimizeLoadedModel(gltf.scene);
                        this.scene.add(gltf.scene);
                        resolve(gltf);
                    },
                    (progress) => {
                        console.log('加载进度:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
                    },
                    reject
                );
            }),
            (gltf) => {
                console.log('主模型加载完成');
                this.applyAllOptimizations();
            }
        );
    }

    // 优化加载的模型
    optimizeLoadedModel(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                // 优化几何体
                if (child.geometry) {
                    ThreeOptimizedUtils.optimizeGeometry(child.geometry);
                }

                // 优化材质
                if (child.material) {
                    child.material = ThreeOptimizedUtils.optimizeMaterial(child.material, {
                        lowQuality: this.isMobile()
                    });
                }

                // 标记静态对象
                child.userData.dynamic = false;
            }
        });
    }

    // 应用所有优化
    applyAllOptimizations() {
        console.log('应用性能优化...');

        // GPU优化
        const gpuResult = this.gpuOptimizer.applyOptimizations();
        console.log('GPU优化结果:', gpuResult.stats);

        // LOD系统
        this.setupLODSystem();

        // 实例化对象
        this.createInstancedObjects();

        // 创建动画
        this.createAnimations();

        console.log('所有优化已应用');
    }

    // 设置LOD系统
    setupLODSystem() {
        this.lodManager = ThreeOptimizedUtils.createLODManager();
        this.lodManager.setCamera(this.camera);

        // 为主要对象创建LOD
        this.scene.traverse((object) => {
            if (object.isMesh && object.geometry) {
                const highDetail = object.clone();
                const mediumDetail = this.simplifyModel(object, 0.5);
                const lowDetail = this.simplifyModel(object, 0.2);

                const lod = this.lodManager.addLODObject(
                    object.uuid,
                    object,
                    [
                        { object: highDetail, distance: 0 },
                        { object: mediumDetail, distance: 100 },
                        { object: lowDetail, distance: 200 }
                    ]
                );

                if (lod !== object) {
                    this.scene.remove(object);
                    this.scene.add(lod);
                }
            }
        });
    }

    // 简化模型
    simplifyModel(model, factor) {
        // 这里应该使用THREE.SimplifyModifier
        // 简化示例：直接克隆
        const simplified = model.clone();
        return simplified;
    }

    // 创建实例化对象
    createInstancedObjects() {
        // 创建示例实例化对象
        const geometry = new THREE.SphereGeometry(5, 16, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });

        const instances = [];
        for (let i = 0; i < 100; i++) {
            instances.push({
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * 200,
                    (Math.random() - 0.5) * 200,
                    (Math.random() - 0.5) * 200
                ),
                scale: new THREE.Vector3(
                    Math.random() * 2 + 0.5,
                    Math.random() * 2 + 0.5,
                    Math.random() * 2 + 0.5
                ),
                color: new THREE.Color(Math.random(), Math.random(), Math.random())
            });
        }

        const instancedMesh = ThreeOptimizedUtils.createInstancedMesh(
            { geometry, material },
            instances
        );

        this.scene.add(instancedMesh);
    }

    // 创建动画
    createAnimations() {
        // 添加旋转动画
        const rotatingObjects = [];
        this.scene.traverse((object) => {
            if (object.isMesh && !object.userData.static) {
                rotatingObjects.push(object);
            }
        });

        rotatingObjects.forEach((obj, index) => {
            this.animationOptimizer.addAnimation(`rotate_${index}`, {
                type: 'rotation',
                target: obj,
                speed: 0.5 + Math.random() * 0.5,
                onUpdate: (value) => {
                    obj.rotation.y = value.rotation.y;
                }
            });
        });
    }

    // 设置事件监听
    setupEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', this.handleResize.bind(this), { passive: true });

        // 页面可见性
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // 模式切换
        document.getElementById('visual-mode').addEventListener('click', () => {
            this.switchMode('visual');
        });

        document.getElementById('print-mode').addEventListener('click', () => {
            this.switchMode('print');
        });
    }

    // 处理窗口大小调整
    handleResize() {
        // 更新相机
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        // 更新渲染器
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // 移动端优化
        if (this.mobileOptimizer) {
            this.mobileOptimizer.handleOrientationChange();
        }
    }

    // 处理页面可见性
    handleVisibilityChange() {
        if (document.hidden) {
            // 暂停动画和渲染
            this.animationOptimizer.pause();
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
        } else {
            // 恢复
            this.animationOptimizer.resume();
            this.startRenderLoop();
        }
    }

    // 切换模式
    switchMode(mode) {
        console.log(`切换到${mode}模式`);

        // 根据模式调整渲染设置
        if (mode === 'print') {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        } else {
            if (this.isMobile()) {
                this.renderer.shadowMap.enabled = false;
            }
        }
    }

    // 开始渲染循环
    startRenderLoop() {
        const render = (time) => {
            this.animationId = requestAnimationFrame(render);

            // 更新性能监控
            this.stats.begin();

            // 更新控制器
            this.controls.update();

            // 更新动画
            const deltaTime = this.animationOptimizer.update(time);

            // 更新LOD
            if (this.lodManager) {
                this.lodManager.update();
            }

            // 渲染
            this.renderer.render(this.scene, this.camera);

            // 更新性能指标
            this.updatePerformanceMetrics();

            this.stats.end();
        };

        this.animationId = requestAnimationFrame(render);
    }

    // 更新性能指标
    updatePerformanceMetrics() {
        // 更新性能分析器
        this.performanceAnalyzer.recordFrame(this.renderer, this.scene, this.camera);

        // 获取统计信息
        const report = this.performanceAnalyzer.getReport();
        this.performanceMetrics = {
            fps: report.currentFPS,
            frameTime: report.averageFrameTime,
            memoryUsage: report.averageMemory,
            drawCalls: report.averageDrawCalls,
            triangles: report.averageTriangles
        };

        // 定期输出性能报告
        if (Math.random() < 0.01) { // 1%概率输出
            console.log('性能报告:', this.performanceMetrics);
        }
    }

    // 检测移动设备
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
    }

    // 获取性能报告
    getPerformanceReport() {
        return {
            metrics: this.performanceMetrics,
            memory: this.memoryOptimizer ? this.memoryOptimizer.getMemoryStats() : null,
            gpu: this.gpuOptimizer ? this.gpuOptimizer.getGPUStats() : null,
            animation: this.animationOptimizer ? this.animationOptimizer.getStats() : null,
            mobile: this.mobileOptimizer ? this.mobileOptimizer.getOptimizationStats() : null
        };
    }

    // 销毁
    destroy() {
        // 停止动画
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // 销毁优化器
        if (this.memoryOptimizer) this.memoryOptimizer.destroy();
        if (this.gpuOptimizer) this.gpuOptimizer.destroy();
        if (this.animationOptimizer) this.animationOptimizer.destroy();
        if (this.mobileOptimizer) this.mobileOptimizer.destroy();

        // 销毁控制器
        if (this.controls) this.controls.dispose();

        // 销毁渲染器
        if (this.renderer) this.renderer.dispose();

        // 清理场景
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        console.log('应用已销毁');
    }
}

// 导出应用类
window.PerformanceOptimizedApp = PerformanceOptimizedApp;

// 当页面加载完成时初始化应用
window.addEventListener('DOMContentLoaded', () => {
    const app = new PerformanceOptimizedApp();

    // 将app实例暴露到全局，方便调试
    window.app = app;

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        app.destroy();
    });
});