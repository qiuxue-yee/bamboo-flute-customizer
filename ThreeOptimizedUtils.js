// Three.js 性能优化工具库
class ThreeOptimizedUtils {
    static createOptimizedRenderer(options = {}) {
        const isMobile = this.detectMobile();
        const pixelRatio = this.getOptimalPixelRatio();

        // 默认配置
        const defaultOptions = {
            antialias: !isMobile,
            alpha: false,
            powerPreference: "high-performance",
            depth: true,
            stencil: false,
            desynchronized: true,
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false
        };

        // 合并配置
        const config = { ...defaultOptions, ...options };

        const renderer = new THREE.WebGLRenderer(config);

        // 设置像素比
        renderer.setPixelRatio(pixelRatio);

        // 输出编码
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        // 阴影设置
        if (isMobile) {
            renderer.shadowMap.enabled = false;
            renderer.shadowMap.type = THREE.BasicShadowMap;
        } else {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        // 性能优化设置
        renderer.info.autoReset = false;

        return renderer;
    }

    static detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
    }

    static getOptimalPixelRatio() {
        const isMobile = this.detectMobile();
        if (isMobile) {
            return Math.min(window.devicePixelRatio, 1.5);
        }
        return Math.min(window.devicePixelRatio, 2);
    }

    // 批处理工具
    static batchMeshes(meshes) {
        const materialGroups = new Map();

        // 按材质分组
        meshes.forEach(mesh => {
            const materialKey = this.getMaterialKey(mesh.material);
            if (!materialGroups.has(materialKey)) {
                materialGroups.set(materialKey, []);
            }
            materialGroups.get(materialKey).push(mesh);
        });

        const batchedMeshes = [];

        // 合并每个组
        materialGroups.forEach((group, materialKey) => {
            if (group.length > 1) {
                const geometries = [];
                group.forEach(mesh => {
                    const geometry = mesh.geometry.clone();
                    geometry.applyMatrix4(mesh.matrixWorld);
                    geometries.push(geometry);
                });

                try {
                    const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
                    const material = group[0].material;
                    const batchedMesh = new THREE.Mesh(mergedGeometry, material);

                    // 保持原网格的位置
                    if (group.length > 0) {
                        batchedMesh.position.copy(group[0].position);
                    }

                    batchedMeshes.push(batchedMesh);
                } catch (error) {
                    console.warn('批处理失败，使用原网格:', error);
                    batchedMeshes.push(...group);
                }
            } else {
                batchedMeshes.push(group[0]);
            }
        });

        return batchedMeshes;
    }

    // 获取材质的唯一标识
    static getMaterialKey(material) {
        if (Array.isArray(material)) {
            return material.map(m => m.uuid).join('_');
        }
        return material.uuid;
    }

    // 创建实例化网格
    static createInstancedMesh(prototypeMesh, instancesData) {
        const geometry = prototypeMesh.geometry;
        const material = prototypeMesh.material;

        const count = instancesData.length;
        const instancedMesh = new THREE.InstancedMesh(geometry, material, count);

        // 创建矩阵数组
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();

        instancesData.forEach((data, index) => {
            matrix.setPosition(data.position);
            matrix.compose(
                data.position,
                data.rotation || new THREE.Quaternion(0, 0, 0, 1),
                data.scale || new THREE.Vector3(1, 1, 1)
            );

            instancedMesh.setMatrixAt(index, matrix);

            if (data.color) {
                color.set(data.color);
                instancedMesh.setColorAt(index, color);
            }
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) {
            instancedMesh.instanceColor.needsUpdate = true;
        }

        return instancedMesh;
    }

    // LOD（细节级别）管理器
    static createLODManager() {
        class LODManager {
            constructor() {
                this.lodGroups = new Map();
                this.camera = null;
            }

            setCamera(camera) {
                this.camera = camera;
            }

            addLODObject(id, object, levels) {
                const lod = new THREE.LOD();

                levels.forEach(level => {
                    lod.addLevel(level.object, level.distance);
                });

                this.lodGroups.set(id, {
                    lod: lod,
                    levels: levels
                });

                return lod;
            }

            update() {
                if (!this.camera) return;

                this.lodGroups.forEach(group => {
                    const distance = group.lod.position.distanceTo(this.camera.position);
                    group.lod.update(this.camera);
                });
            }

            dispose() {
                this.lodGroups.forEach(group => {
                    group.levels.forEach(level => {
                        if (level.object.geometry) {
                            level.object.geometry.dispose();
                        }
                        if (level.object.material) {
                            if (Array.isArray(level.object.material)) {
                                level.object.material.forEach(m => m.dispose());
                            } else {
                                level.object.material.dispose();
                            }
                        }
                    });
                });
                this.lodGroups.clear();
            }
        }

        return new LODManager();
    }

    // 纹理优化工具
    static optimizeTexture(texture, options = {}) {
        const isMobile = this.detectMobile();
        const maxSize = options.maxSize || (isMobile ? 512 : 1024);

        // 压缩纹理大小
        if (texture.image && (texture.image.width > maxSize || texture.image.height > maxSize)) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const scale = Math.min(maxSize / texture.image.width, maxSize / texture.image.height);
            canvas.width = texture.image.width * scale;
            canvas.height = texture.image.height * scale;

            ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);

            texture.image = canvas;
            texture.needsUpdate = true;
        }

        // 设置纹理参数
        texture.generateMipmaps = options.generateMipmaps !== false && !isMobile;
        texture.minFilter = isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = options.anisotropy !== undefined ?
            options.anisotropy : (isMobile ? 1 : Math.min(4, 8));
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return texture;
    }

    // 几何体优化工具
    static optimizeGeometry(geometry) {
        // 合并顶点
        if (geometry.attributes.position) {
            geometry.mergeVertices();
        }

        // 计算边界盒和球
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        // 优化索引
        if (geometry.index) {
            geometry.computeVertexNormals();
        }

        return geometry;
    }

    // 材质优化工具
    static optimizeMaterial(material, options = {}) {
        const isMobile = this.detectMobile();

        // 移动端简化
        if (isMobile) {
            material.flatShading = true;
            material.wireframe = false;

            // 禁用一些高级特性
            if (material.map) {
                material.map.generateMipmaps = false;
                material.map.anisotropy = 1;
            }
        }

        // 优化光照
        if (material instanceof THREE.MeshStandardMaterial ||
            material instanceof THREE.MeshPhysicalMaterial) {
            if (options.lowQuality !== false && isMobile) {
                // 降级为基础材质
                const basicMaterial = new THREE.MeshBasicMaterial({
                    map: material.map,
                    color: material.color,
                    transparent: material.transparent,
                    opacity: material.opacity
                });
                return basicMaterial;
            }
        }

        return material;
    }

    // 预加载管理器
    static createPreloadManager() {
        class PreloadManager {
            constructor() {
                this.queue = [];
                this.loading = false;
                this.maxConcurrent = 3;
                this.currentLoads = 0;
            }

            add(loadFn, onComplete, onError) {
                this.queue.push({
                    loadFn,
                    onComplete,
                    onError
                });
                this.process();
            }

            process() {
                if (this.loading || this.queue.length === 0 ||
                    this.currentLoads >= this.maxConcurrent) {
                    return;
                }

                this.loading = true;
                const item = this.queue.shift();
                this.currentLoads++;

                item.loadFn()
                    .then(result => {
                        if (item.onComplete) item.onComplete(result);
                    })
                    .catch(error => {
                        if (item.onError) item.onError(error);
                    })
                    .finally(() => {
                        this.currentLoads--;
                        this.loading = false;
                        this.process();
                    });
            }

            clear() {
                this.queue = [];
            }
        }

        return new PreloadManager();
    }

    // 性能分析器
    static createPerformanceAnalyzer() {
        class PerformanceAnalyzer {
            constructor() {
                this.metrics = {
                    fps: [],
                    frameTime: [],
                    drawCalls: [],
                    triangles: [],
                    memory: []
                };
                this.isRunning = false;
                this.startTime = 0;
            }

            start() {
                this.isRunning = true;
                this.startTime = performance.now();
            }

            stop() {
                this.isRunning = false;
            }

            recordFrame(renderer, scene, camera) {
                if (!this.isRunning) return;

                const currentTime = performance.now();
                const deltaTime = currentTime - this.lastTime || 16;

                // 记录FPS
                this.metrics.fps.push(1000 / deltaTime);
                if (this.metrics.fps.length > 100) {
                    this.metrics.fps.shift();
                }

                // 记录帧时间
                this.metrics.frameTime.push(deltaTime);
                if (this.metrics.frameTime.length > 100) {
                    this.metrics.frameTime.shift();
                }

                // 记录渲染统计
                if (renderer && renderer.info) {
                    this.metrics.drawCalls.push(renderer.info.render.calls);
                    this.metrics.triangles.push(renderer.info.render.triangles);

                    if (this.metrics.drawCalls.length > 100) {
                        this.metrics.drawCalls.shift();
                    }
                    if (this.metrics.triangles.length > 100) {
                        this.metrics.triangles.shift();
                    }
                }

                // 记录内存
                if (performance.memory) {
                    this.metrics.memory.push(performance.memory.usedJSHeapSize / 1048576);
                    if (this.metrics.memory.length > 100) {
                        this.metrics.memory.shift();
                    }
                }

                this.lastTime = currentTime;
            }

            getReport() {
                const calculateAverage = (arr) => {
                    if (arr.length === 0) return 0;
                    return arr.reduce((a, b) => a + b, 0) / arr.length;
                };

                return {
                    averageFPS: calculateAverage(this.metrics.fps),
                    averageFrameTime: calculateAverage(this.metrics.frameTime),
                    averageDrawCalls: calculateAverage(this.metrics.drawCalls),
                    averageTriangles: calculateAverage(this.metrics.triangles),
                    averageMemory: calculateAverage(this.metrics.memory),
                    currentFPS: this.metrics.fps[this.metrics.fps.length - 1] || 0
                };
            }

            reset() {
                this.metrics = {
                    fps: [],
                    frameTime: [],
                    drawCalls: [],
                    triangles: [],
                    memory: []
                };
            }
        }

        return new PerformanceAnalyzer();
    }

    // 遮挡剔除工具
    static createOcclusionCuller() {
        class OcclusionCuller {
            constructor(camera) {
                this.camera = camera;
                this.objects = [];
                this.frustum = new THREE.Frustum();
                this.projScreenMatrix = new THREE.Matrix4();
            }

            addObject(object) {
                if (object.geometry) {
                    object.geometry.computeBoundingBox();
                    this.objects.push(object);
                }
            }

            removeObject(object) {
                const index = this.objects.indexOf(object);
                if (index !== -1) {
                    this.objects.splice(index, 1);
                }
            }

            cull() {
                this.frustum.setFromProjectionMatrix(
                    this.projScreenMatrix.multiplyMatrices(
                        this.camera.projectionMatrix,
                        this.camera.matrixWorldInverse
                    )
                );

                const visibleObjects = [];

                this.objects.forEach(object => {
                    if (object.geometry.boundingBox) {
                        if (this.frustum.intersectsBox(object.geometry.boundingBox)) {
                            object.visible = true;
                            visibleObjects.push(object);
                        } else {
                            object.visible = false;
                        }
                    }
                });

                return visibleObjects;
            }
        }

        return (camera) => new OcclusionCuller(camera);
    }
}

// 导出工具类
window.ThreeOptimizedUtils = ThreeOptimizedUtils;