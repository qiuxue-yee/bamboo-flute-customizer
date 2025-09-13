// GPU优化管理器
class GPUOptimizer {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.drawCalls = new Map();
        this.materialGroups = new Map();
        this.isMobile = this.detectMobile();
        this.targetDrawCalls = this.isMobile ? 100 : 500; // 目标Draw Calls数量
        this.batches = [];
    }

    // 合并材质相似的网格
    mergeSimilarMaterials() {
        const materials = new Map();

        // 遍历场景收集材质
        this.scene.traverse((object) => {
            if (object.isMesh && object.material) {
                const key = this.getMaterialKey(object.material);
                if (!materials.has(key)) {
                    materials.set(key, {
                        material: object.material,
                        meshes: []
                    });
                }
                materials.get(key).meshes.push(object);
            }
        });

        // 批处理
        materials.forEach((group) => {
            if (group.meshes.length > 1) {
                this.batchMeshes(group.meshes, group.material);
            }
        });
    }

    // 批处理网格
    batchMeshes(meshes, material) {
        // 过滤出可以使用相同材质的网格
        const batchableMeshes = meshes.filter(mesh => {
            // 检查是否可以合并
            return this.canMergeMesh(mesh, material);
        });

        if (batchableMeshes.length < 2) return;

        // 创建批处理
        const batch = {
            meshes: batchableMeshes,
            material: material,
            originalMeshes: [...batchableMeshes]
        };

        // 创建合并的几何体
        const geometries = batchableMeshes.map(mesh => {
            const geometry = mesh.geometry.clone();
            geometry.applyMatrix4(mesh.matrixWorld);
            return geometry;
        });

        try {
            const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometries);
            const batchedMesh = new THREE.Mesh(mergedGeometry, material);

            // 移除原网格
            batchableMeshes.forEach(mesh => {
                this.scene.remove(mesh);
            });

            // 添加批处理后的网格
            this.scene.add(batchedMesh);

            this.batches.push({
                mesh: batchedMesh,
                originalMeshes: batchableMeshes
            });

            console.log(`批处理完成: ${batchableMeshes.length} 个网格合并为 1 个`);
        } catch (error) {
            console.warn('批处理失败:', error);
        }
    }

    // 检查是否可以合并网格
    canMergeMesh(mesh, material) {
        // 检查材质是否相同
        if (mesh.material !== material) return false;

        // 检查是否需要单独更新
        if (mesh.userData.dynamic) return false;

        // 检查是否有动画
        if (mesh.userData.hasAnimation) return false;

        return true;
    }

    // 获取材质的唯一键
    getMaterialKey(material) {
        if (Array.isArray(material)) {
            return material.map(m => m.uuid).join('_');
        }

        const properties = [
            material.type,
            material.color ? material.color.getHexString() : '',
            material.map ? material.map.uuid : '',
            material.transparent,
            material.opacity,
            material.roughness,
            material.metalness
        ];

        return properties.join('|');
    }

    // 使用实例化渲染
    createInstancedObjects() {
        const instancesMap = new Map();

        // 收集可以实例化的对象
        this.scene.traverse((object) => {
            if (object.isMesh && !object.userData.dynamic) {
                const key = this.getInstanceKey(object);
                if (!instancesMap.has(key)) {
                    instancesMap.set(key, []);
                }
                instancesMap.get(key).push(object);
            }
        });

        // 创建实例化对象
        instancesMap.forEach((instances, key) => {
            if (instances.length > 3) { // 只有3个以上才值得实例化
                this.createInstancedMesh(instances);
            }
        });
    }

    // 获取实例化键
    getInstanceKey(mesh) {
        return [
            mesh.geometry.uuid,
            this.getMaterialKey(mesh.material)
        ].join('|');
    }

    // 创建实例化网格
    createInstancedMesh(instances) {
        const prototype = instances[0];
        const geometry = prototype.geometry;
        const material = prototype.material;
        const count = instances.length;

        const instancedMesh = new THREE.InstancedMesh(geometry, material, count);

        // 设置每个实例的变换
        const matrix = new THREE.Matrix4();
        instances.forEach((instance, index) => {
            matrix.compose(
                instance.position,
                instance.quaternion,
                instance.scale
            );
            instancedMesh.setMatrixAt(index, matrix);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;

        // 移除原网格
        instances.forEach(instance => {
            this.scene.remove(instance);
        });

        // 添加实例化网格
        this.scene.add(instancedMesh);

        console.log(`实例化完成: ${count} 个对象实例化`);
    }

    // 优化阴影
    optimizeShadows() {
        const shadowCasters = [];

        // 收集投射阴影的物体
        this.scene.traverse((object) => {
            if (object.castShadow && object.isMesh) {
                shadowCasters.push(object);
            }
        });

        // 如果太多阴影，优化
        if (shadowCasters.length > 10) {
            // 只保留最近的物体投射阴影
            shadowCasters.sort((a, b) => {
                return a.position.length() - b.position.length();
            });

            // 禁用远处物体的阴影
            shadowCasters.slice(5).forEach(object => {
                object.castShadow = false;
            });

            console.log(`阴影优化: 保留 5 个投射者，禁用 ${shadowCasters.length - 5} 个`);
        }

        // 优化阴影贴图大小
        if (this.isMobile) {
            this.renderer.shadowMap.type = THREE.BasicShadowMap;
            this.scene.traverse((object) => {
                if (object.shadow && object.shadow.map) {
                    object.shadow.mapSize.width = 512;
                    object.shadow.mapSize.height = 512;
                }
            });
        }
    }

    // 优化渲染队列
    optimizeRenderQueue() {
        // 按材质和距离排序
        const renderList = [];

        this.scene.traverse((object) => {
            if (object.isMesh && object.visible) {
                renderList.push(object);
            }
        });

        // 按材质分组
        const materialGroups = new Map();
        renderList.forEach(object => {
            const key = this.getMaterialKey(object.material);
            if (!materialGroups.has(key)) {
                materialGroups.set(key, []);
            }
            materialGroups.get(key).push(object);
        });

        // 在每个材质组内按距离排序（从前到后）
        materialGroups.forEach(group => {
            group.sort((a, b) => {
                return b.position.length() - a.position.length();
            });
        });

        // 创建有序的渲染列表
        const orderedRenderList = [];
        materialGroups.forEach(group => {
            orderedRenderList.push(...group);
        });

        return orderedRenderList;
    }

    // 使用GPU实例化
    enableGPUInstancing() {
        // 检查支持
        if (!this.renderer.capabilities.isWebGL2) {
            console.warn('WebGL2不支持，无法使用GPU实例化');
            return;
        }

        // 使用EXT_instanced_arrays扩展
        if (this.renderer.extensions.get('ANGLE_instanced_arrays')) {
            console.log('启用GPU实例化');
        }
    }

    // 优化纹理图集
    createTextureAtlas(textures) {
        // 创建纹理图集以减少纹理切换
        const atlasSize = 2048;
        const canvas = document.createElement('canvas');
        canvas.width = atlasSize;
        canvas.height = atlasSize;
        const ctx = canvas.getContext('2d');

        // 简单的图集布局
        let x = 0, y = 0, rowHeight = 0;
        const regions = [];

        textures.forEach((texture, index) => {
            if (x + texture.image.width > atlasSize) {
                x = 0;
                y += rowHeight;
                rowHeight = 0;
            }

            ctx.drawImage(texture.image, x, y);
            regions.push({
                x: x / atlasSize,
                y: y / atlasSize,
                width: texture.image.width / atlasSize,
                height: texture.image.height / atlasSize,
                index: index
            });

            x += texture.image.width;
            rowHeight = Math.max(rowHeight, texture.image.height);
        });

        // 创建图集纹理
        const atlasTexture = new THREE.CanvasTexture(canvas);
        atlasTexture.minFilter = THREE.LinearFilter;
        atlasTexture.magFilter = THREE.LinearFilter;

        return {
            texture: atlasTexture,
            regions: regions
        };
    }

    // 禁用不必要的特性
    disableUnnecessaryFeatures() {
        // 移动端禁用高级特性
        if (this.isMobile) {
            this.scene.traverse((object) => {
                if (object.material) {
                    // 禁用法线贴图
                    if (object.material.normalMap) {
                        object.material.normalMap = null;
                    }

                    // 禁用高光贴图
                    if (object.material.roughnessMap) {
                        object.material.roughness = 0.5;
                        object.material.roughnessMap = null;
                    }

                    // 禁用金属贴图
                    if (object.material.metalnessMap) {
                        object.material.metalness = 0;
                        object.material.metalnessMap = null;
                    }

                    object.material.needsUpdate = true;
                }
            });
        }
    }

    // 获取GPU统计信息
    getGPUStats() {
        const info = this.renderer.info;
        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs ? info.programs.length : 0,
            batches: this.batches.length
        };
    }

    // 应用所有优化
    applyOptimizations() {
        console.log('开始GPU优化...');

        // 1. 合并相似材质
        this.mergeSimilarMaterials();

        // 2. 实例化渲染
        this.createInstancedObjects();

        // 3. 优化阴影
        this.optimizeShadows();

        // 4. 禁用不必要特性
        this.disableUnnecessaryFeatures();

        // 5. 优化渲染队列
        const optimizedRenderList = this.optimizeRenderQueue();

        // 获取优化后的统计
        const stats = this.getGPUStats();
        console.log('GPU优化完成:', stats);

        return {
            stats: stats,
            renderList: optimizedRenderList
        };
    }

    // 检测移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
    }

    // 销毁
    destroy() {
        // 恢复批处理的网格
        this.batches.forEach(batch => {
            this.scene.remove(batch.mesh);
            batch.originalMeshes.forEach(mesh => {
                this.scene.add(mesh);
            });
        });

        this.batches = [];
    }
}

// 导出GPU优化器
window.GPUOptimizer = GPUOptimizer;