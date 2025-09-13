// 性能优化的3D渲染器实现
class DiziCustomizer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.diziModel = null;
        this.stats = null;
        this.currentMode = 'visual';
        this.originalMaterials = new Map();
        this.textureCache = new Map();
        this.geometryCache = new Map();
        this.isMobile = this.detectMobile();
        this.pixelRatio = this.getOptimalPixelRatio();

        // 性能优化：批处理和实例化
        this.instanceManager = {
            instances: new Map(),
            batchCount: 0
        };

        // 动画优化
        this.animationFrameId = null;
        this.lastTime = 0;
        this.targetFPS = this.isMobile ? 30 : 60;
        this.frameInterval = 1000 / this.targetFPS;

        // 初始化优化代理
        this.animationOptimizer = null;
        this.gpuOptimizer = null;
        this.memoryOptimizer = null;
        this.mobileOptimizer = null;
        this.agentIntegration = null;

        // 初始化
        this.init();
    }

    // 检测移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
    }

    // 获取最优像素比
    getOptimalPixelRatio() {
        if (this.isMobile) {
            // 移动设备限制为1.5倍以节省性能
            return Math.min(window.devicePixelRatio, 1.5);
        }
        // 桌面设备限制为2倍
        return Math.min(window.devicePixelRatio, 2);
    }

    // 初始化场景
    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        this.setupPerformanceMonitoring();
        this.loadModel();
        this.setupEventListeners();
        this.setupOptimizationAgents();
        this.animate();
    }

    // 设置场景
    setupScene() {
        // 使用优化的场景设置
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f2f5);

        // 启用雾效果以优化远处物体渲染
        this.scene.fog = new THREE.Fog(0xf0f2f5, 100, 1000);

        // 设置阴影（选择性启用）
        this.scene.autoUpdate = false; // 手动控制更新以提升性能
    }

    // 设置相机
    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(
            45, // 使用45度视野以优化性能
            aspect,
            0.1,
            1000
        );

        // 设置相机位置
        this.camera.position.set(0, 0, 300);
        this.camera.lookAt(0, 0, 0);

        // 相机性能优化
        this.camera.matrixAutoUpdate = false;
        this.camera.updateMatrix();
    }

    // 设置渲染器
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: !this.isMobile, // 移动设备禁用抗锯齿
            alpha: false,
            powerPreference: "high-performance", // 优先性能
            depth: true,
            stencil: false,
            desynchronized: true // 异步渲染
        });

        // 设置渲染器参数
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // 移动端优化
        if (this.isMobile) {
            this.renderer.shadowMap.enabled = false;
            this.renderer.shadowMap.type = THREE.BasicShadowMap;
        } else {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        // 批处理优化
        this.renderer.info.autoReset = false;

        // 添加到DOM
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    }

    // 设置灯光
    setupLights() {
        // 环境光（优化性能）
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // 主光源（使用点光源优化性能）
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(100, 100, 100);
        mainLight.castShadow = !this.isMobile;

        // 优化阴影设置
        if (!this.isMobile) {
            mainLight.shadow.camera.near = 0.1;
            mainLight.shadow.camera.far = 500;
            mainLight.shadow.camera.left = -100;
            mainLight.shadow.camera.right = 100;
            mainLight.shadow.camera.top = 100;
            mainLight.shadow.camera.bottom = -100;
            mainLight.shadow.mapSize.width = 1024;
            mainLight.shadow.mapSize.height = 1024;
            mainLight.shadow.bias = -0.0001;
        }

        this.scene.add(mainLight);

        // 补充光源（使用半球光优化）
        const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3);
        this.scene.add(hemiLight);
    }

    // 设置控制器
    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);

        // 优化控制器设置
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 500;
        this.controls.maxPolarAngle = Math.PI / 2;

        // 移动端优化
        if (this.isMobile) {
            this.controls.rotateSpeed = 0.5;
            this.controls.zoomSpeed = 0.5;
            this.controls.panSpeed = 0.5;
            this.touches = {
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN
            };
        }

        // 禁用自动旋转以节省性能
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = 0.5;
    }

    // 设置性能监控
    setupPerformanceMonitoring() {
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
        this.stats.dom.style.position = 'relative';
        document.getElementById('stats-container').appendChild(this.stats.dom);

        // 定期检查内存使用
        setInterval(() => {
            this.checkMemoryUsage();
        }, 5000);
    }

    // 检查内存使用
    checkMemoryUsage() {
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize / 1048576;
            const total = performance.memory.totalJSHeapSize / 1048576;
            const limit = performance.memory.jsHeapSizeLimit / 1048576;

            if (used > total * 0.8) {
                console.warn(`内存使用过高: ${used.toFixed(2)}MB / ${limit.toFixed(2)}MB`);
                this.optimizeMemory();
            }
        }
    }

    // 内存优化
    optimizeMemory() {
        // 清理纹理缓存
        this.textureCache.forEach((texture, key) => {
            if (!this.isTextureInUse(texture)) {
                texture.dispose();
                this.textureCache.delete(key);
            }
        });

        // 清理几何体缓存
        this.geometryCache.forEach((geometry, key) => {
            if (!this.isGeometryInUse(geometry)) {
                geometry.dispose();
                this.geometryCache.delete(key);
            }
        });

        // 强制垃圾回收（如果可用）
        if (window.gc) {
            window.gc();
        }
    }

    // 检查纹理是否在使用中
    isTextureInUse(texture) {
        let inUse = false;
        this.scene.traverse((child) => {
            if (child.material && child.material.map === texture) {
                inUse = true;
            }
        });
        return inUse;
    }

    // 检查几何体是否在使用中
    isGeometryInUse(geometry) {
        let inUse = false;
        this.scene.traverse((child) => {
            if (child.geometry === geometry) {
                inUse = true;
            }
        });
        return inUse;
    }

    // 加载模型
    loadModel() {
        const loader = new THREE.GLTFLoader();

        loader.load(
            'assets/Dizi_Display.glb',
            (gltf) => {
                // 优化加载的模型
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        // 保存原始材质
                        this.originalMaterials.set(child.uuid, child.material);

                        // 优化材质
                        if (this.isMobile) {
                            child.material = this.optimizeMaterialForMobile(child.material);
                        }

                        // 优化几何体
                        if (child.geometry) {
                            child.geometry.computeBoundingBox();
                            child.geometry.computeBoundingSphere();

                            // 合并顶点
                            if (child.geometry.attributes.position) {
                                child.geometry.mergeVertices();
                            }
                        }
                    }
                });

                // 设置模型
                this.diziModel = gltf.scene;
                this.scene.add(this.diziModel);

                // 居中模型
                this.centerModel();

                // 优化场景
                this.optimizeScene();
            },
            (progress) => {
                const percent = (progress.loaded / progress.total) * 100;
                console.log(`模型加载进度: ${percent.toFixed(2)}%`);
            },
            (error) => {
                console.error('模型加载失败:', error);
            }
        );
    }

    // 移动端材质优化
    optimizeMaterialForMobile(material) {
        if (material.map) {
            // 压缩纹理
            material.map.generateMipmaps = false;
            material.map.minFilter = THREE.LinearFilter;
            material.map.magFilter = THREE.LinearFilter;
            material.map.anisotropy = 1;
        }

        // 简化材质
        material.flatShading = true;
        material.needsUpdate = true;

        return material;
    }

    // 居中模型
    centerModel() {
        const box = new THREE.Box3().setFromObject(this.diziModel);
        const center = box.getCenter(new THREE.Vector3());

        this.diziModel.position.sub(center);

        // 调整相机
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));

        this.camera.position.z = cameraZ * 1.5;
        this.camera.updateMatrix();
    }

    // 优化场景
    optimizeScene() {
        // 批处理静态对象
        this.batchStaticObjects();

        // 实例化相似对象
        this.createInstances();

        // 设置LOD
        this.setupLOD();

        // 冻结静态对象
        this.freezeStaticObjects();
    }

    // 批处理静态对象
    batchStaticObjects() {
        const staticMeshes = [];

        this.scene.traverse((child) => {
            if (child.isMesh && child.geometry && child.material) {
                staticMeshes.push(child);
            }
        });

        // 按材质分组
        const materialGroups = new Map();
        staticMeshes.forEach(mesh => {
            const materialKey = mesh.material.uuid;
            if (!materialGroups.has(materialKey)) {
                materialGroups.set(materialKey, []);
            }
            materialGroups.get(materialKey).push(mesh);
        });

        // 合并使用相同材质的网格
        materialGroups.forEach((meshes, materialKey) => {
            if (meshes.length > 1) {
                const geometries = [];
                meshes.forEach(mesh => {
                    const geometry = mesh.geometry.clone();
                    geometry.applyMatrix4(mesh.matrixWorld);
                    geometries.push(geometry);
                });

                const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
                const material = meshes[0].material;
                const batchedMesh = new THREE.Mesh(mergedGeometry, material);

                // 移除原网格
                meshes.forEach(mesh => {
                    this.scene.remove(mesh);
                });

                // 添加批处理后的网格
                this.scene.add(batchedMesh);

                this.instanceManager.batchCount++;
            }
        });
    }

    // 创建实例
    createInstances() {
        // 如果有重复对象，使用实例化渲染
        // 这里可以根据实际需求实现
    }

    // 设置LOD
    setupLOD() {
        // 根据距离选择不同的细节级别
        if (this.diziModel) {
            const lod = new THREE.LOD();

            // 创建不同级别的模型
            const highDetail = this.diziModel.clone();
            const mediumDetail = this.simplifyModel(highDetail, 0.5);
            const lowDetail = this.simplifyModel(highDetail, 0.2);

            lod.addLevel(highDetail, 0);
            lod.addLevel(mediumDetail, 100);
            lod.addLevel(lowDetail, 200);

            this.scene.remove(this.diziModel);
            this.scene.add(lod);
            this.diziModel = lod;
        }
    }

    // 简化模型
    simplifyModel(model, factor) {
        const simplified = model.clone();

        // 这里可以使用模型简化算法
        // 例如使用THREE.SimplifyModifier

        return simplified;
    }

    // 冻结静态对象
    freezeStaticObjects() {
        this.scene.traverse((child) => {
            if (child.isMesh && !child.userData.dynamic) {
                child.matrixAutoUpdate = false;
                child.updateMatrix();
            }
        });
    }

    // 设置事件监听器
    setupEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', this.handleResize.bind(this), { passive: true });

        // 模式切换
        document.getElementById('visual-mode').addEventListener('click', () => {
            this.switchMode('visual');
        });

        document.getElementById('print-mode').addEventListener('click', () => {
            this.switchMode('print');
        });

        // 文件上传
        document.getElementById('pattern-upload').addEventListener('change', (e) => {
            this.handlePatternUpload(e);
        });

        document.getElementById('emboss-upload').addEventListener('change', (e) => {
            this.handleEmbossUpload(e);
        });

        // 文字输入
        document.getElementById('text-input').addEventListener('input', (e) => {
            this.handleTextInput(e);
        });

        document.getElementById('emboss-text').addEventListener('input', (e) => {
            this.handleEmbossTextInput(e);
        });

        // 滑块控制
        document.getElementById('emboss-depth').addEventListener('input', (e) => {
            document.getElementById('emboss-depth-value').textContent = e.target.value;
            this.updateEmbossDepth(e.target.value);
        });

        document.getElementById('emboss-height').addEventListener('input', (e) => {
            document.getElementById('emboss-height-value').textContent = e.target.value;
            this.updateEmbossHeight(e.target.value);
        });

        // 导出按钮
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportModel();
        });
    }

    // 设置优化代理
    setupOptimizationAgents() {
        console.log('初始化优化代理...');

        // 初始化各个优化代理
        try {
            this.animationOptimizer = new AnimationOptimizer();
            this.gpuOptimizer = new GPUOptimizer(this.renderer, this.scene);
            this.memoryOptimizer = new MemoryOptimizer(this.renderer, this.scene);
            this.mobileOptimizer = new MobileOptimizer(this.renderer, this.scene, this.camera);

            console.log('优化代理初始化完成');

            // 初始化代理集成系统
            this.agentIntegration = new AgentIntegration(this);

            // 启动性能监控
            this.agentIntegration.startPerformanceMonitoring();

            // 启动优化循环
            this.startOptimizationLoop();

            console.log('代理协调系统启动完成');

        } catch (error) {
            console.error('优化代理初始化失败:', error);
        }
    }

    // 启动优化循环
    startOptimizationLoop() {
        setInterval(() => {
            if (this.agentIntegration) {
                this.agentIntegration.runOptimizationCycle();
            }
        }, 10000); // 每10秒运行一次优化循环
    }

    // 获取系统状态
    getSystemStatus() {
        if (this.agentIntegration) {
            return this.agentIntegration.getSystemStats();
        }
        return null;
    }

    // 手动触发优化
    triggerOptimization() {
        if (this.agentIntegration) {
            this.agentIntegration.forceReoptimize();
        }
    }

    // 处理窗口大小调整
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // 更新相机
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        // 更新渲染器
        this.renderer.setSize(width, height);

        // 更新像素比
        const newPixelRatio = this.getOptimalPixelRatio();
        if (newPixelRatio !== this.pixelRatio) {
            this.pixelRatio = newPixelRatio;
            this.renderer.setPixelRatio(this.pixelRatio);
        }
    }

    // 切换模式
    switchMode(mode) {
        this.currentMode = mode;

        // 更新UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${mode}-mode`).classList.add('active');

        // 显示/隐藏控制面板
        document.getElementById('visual-controls').style.display = mode === 'visual' ? 'block' : 'none';
        document.getElementById('print-controls').style.display = mode === 'print' ? 'block' : 'none';

        // 更新渲染设置
        this.updateRenderSettings();
    }

    // 更新渲染设置
    updateRenderSettings() {
        if (this.currentMode === 'print') {
            // 打印模式需要更高的精度
            this.renderer.shadowMap.enabled = true;
        } else {
            // 视觉模式可以降低精度以提高性能
            if (this.isMobile) {
                this.renderer.shadowMap.enabled = false;
            }
        }
    }

    // 处理图案上传
    handlePatternUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const image = new Image();
                image.onload = () => {
                    const texture = new THREE.Texture(image);
                    texture.needsUpdate = true;

                    // 优化纹理
                    this.optimizeTexture(texture);

                    // 应用到模型
                    this.applyPatternTexture(texture);
                };
                image.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    // 处理浮雕上传
    handleEmbossUpload(event) {
        // 处理浮雕图片上传
        const file = event.target.files[0];
        if (file && this.currentMode === 'print') {
            // 实现浮雕逻辑
            console.log('处理浮雕上传');
        }
    }

    // 处理文字输入
    handleTextInput(event) {
        const text = event.target.value;
        if (text) {
            // 创建文字纹理
            this.createTextTexture(text);
        }
    }

    // 处理浮雕文字输入
    handleEmbossTextInput(event) {
        const text = event.target.value;
        if (text && this.currentMode === 'print') {
            // 创建浮雕文字
            console.log('创建浮雕文字:', text);
        }
    }

    // 优化纹理
    optimizeTexture(texture) {
        // 限制纹理大小
        const maxSize = this.isMobile ? 512 : 1024;
        const image = texture.image;

        if (image.width > maxSize || image.height > maxSize) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const scale = Math.min(maxSize / image.width, maxSize / image.height);
            canvas.width = image.width * scale;
            canvas.height = image.height * scale;

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            texture.image = canvas;
            texture.needsUpdate = true;
        }

        // 设置纹理参数
        texture.generateMipmaps = !this.isMobile;
        texture.minFilter = this.isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = this.isMobile ? 1 : Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // 缓存纹理
        const textureKey = `texture_${Date.now()}`;
        this.textureCache.set(textureKey, texture);
    }

    // 应用图案纹理
    applyPatternTexture(texture) {
        if (this.diziModel) {
            this.diziModel.traverse((child) => {
                if (child.isMesh && child.material && child.userData.isPatternArea) {
                    child.material.map = texture;
                    child.material.needsUpdate = true;
                }
            });
        }
    }

    // 创建文字纹理
    createTextTexture(text) {
        const fontSize = document.getElementById('font-size').value;
        const color = document.getElementById('text-color').value;

        // 创建canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 设置canvas大小
        canvas.width = 512;
        canvas.height = 256;

        // 清空canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 设置文字样式
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 绘制文字
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        // 创建纹理
        const texture = new THREE.CanvasTexture(canvas);
        this.optimizeTexture(texture);

        // 应用到模型
        this.applyTextTexture(texture);
    }

    // 应用文字纹理
    applyTextTexture(texture) {
        if (this.diziModel) {
            this.diziModel.traverse((child) => {
                if (child.isMesh && child.material && child.userData.isTextArea) {
                    child.material.map = texture;
                    child.material.needsUpdate = true;
                }
            });
        }
    }

    // 更新浮雕深度
    updateEmbossDepth(value) {
        // 更新浮雕深度
        console.log('浮雕深度:', value);
    }

    // 更新浮雕高度
    updateEmbossHeight(value) {
        // 更新浮雕高度
        console.log('浮雕高度:', value);
    }

    // 导出模型
    exportModel() {
        const exporter = new THREE.GLTFExporter();

        exporter.parse(
            this.scene,
            (gltf) => {
                const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `dizi_${this.currentMode}_${Date.now()}.glb`;
                link.click();

                URL.revokeObjectURL(url);
            },
            (error) => {
                console.error('导出失败:', error);
            },
            { binary: true }
        );
    }

    // 动画循环
    animate(currentTime = 0) {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

        // FPS限制
        if (currentTime - this.lastTime < this.frameInterval) {
            return;
        }
        this.lastTime = currentTime;

        // 更新性能监控
        this.stats.begin();

        // 更新控制器
        if (this.controls.enabled) {
            this.controls.update();
        }

        // 更新场景
        if (this.scene.autoUpdate) {
            this.scene.updateMatrixWorld();
        }

        // 渲染场景
        this.renderer.render(this.scene, this.camera);

        // 更新性能信息
        this.updatePerformanceInfo();

        this.stats.end();
    }

    // 更新性能信息
    updatePerformanceInfo() {
        const info = this.renderer.info;

        // 可以在这里添加自定义的性能信息显示
        if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            console.log(`内存使用: ${(memory.usedJSHeapSize / 1048576).toFixed(2)}MB`);
        }
    }

    // 销毁
    destroy() {
        // 取消动画
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // 清理资源
        this.textureCache.forEach(texture => texture.dispose());
        this.geometryCache.forEach(geometry => geometry.dispose());

        // 移除事件监听器
        window.removeEventListener('resize', this.handleResize);

        // 清理渲染器
        if (this.renderer) {
            this.renderer.dispose();
        }

        // 清理控制器
        if (this.controls) {
            this.controls.dispose();
        }
    }
}

// 全局实例
let app;

// 初始化应用
window.addEventListener('DOMContentLoaded', () => {
    app = new DiziCustomizer();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});