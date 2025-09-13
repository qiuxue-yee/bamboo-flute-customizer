// 内存优化管理器
class MemoryOptimizer {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.textureCache = new Map();
        this.geometryCache = new Map();
        this.materialCache = new Map();
        this.cleanupInterval = 30000; // 30秒清理一次
        this.lastCleanupTime = 0;
        this.memoryThreshold = 0.8; // 80%内存使用阈值
    }

    // 缓存纹理
    cacheTexture(key, texture) {
        // 优化纹理
        this.optimizeTexture(texture);

        // 缓存
        this.textureCache.set(key, texture);

        // 限制缓存大小
        this.enforceCacheLimit(this.textureCache, 20);

        return texture;
    }

    // 获取缓存的纹理
    getTexture(key) {
        return this.textureCache.get(key);
    }

    // 缓存几何体
    cacheGeometry(key, geometry) {
        // 优化几何体
        this.optimizeGeometry(geometry);

        // 缓存
        this.geometryCache.set(key, geometry);

        // 限制缓存大小
        this.enforceCacheLimit(this.geometryCache, 50);

        return geometry;
    }

    // 获取缓存的几何体
    getGeometry(key) {
        return this.geometryCache.get(key);
    }

    // 缓存材质
    cacheMaterial(key, material) {
        // 优化材质
        this.optimizeMaterial(material);

        // 缓存
        this.materialCache.set(key, material);

        // 限制缓存大小
        this.enforceCacheLimit(this.materialCache, 30);

        return material;
    }

    // 获取缓存的材质
    getMaterial(key) {
        return this.materialCache.get(key);
    }

    // 优化纹理
    optimizeTexture(texture) {
        const isMobile = this.detectMobile();
        const maxSize = isMobile ? 512 : 1024;

        // 压缩纹理
        if (texture.image) {
            if (texture.image.width > maxSize || texture.image.height > maxSize) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const scale = Math.min(maxSize / texture.image.width, maxSize / texture.image.height);
                canvas.width = texture.image.width * scale;
                canvas.height = texture.image.height * scale;

                ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);

                texture.image = canvas;
                texture.needsUpdate = true;
            }

            // 使用合适的压缩格式
            if (this.renderer.extensions.has('WEBGL_compressed_texture_s3tc')) {
                // 如果支持S3TC，可以在这里压缩
            }
        }

        // 设置纹理参数
        texture.generateMipmaps = !isMobile;
        texture.minFilter = isMobile ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = isMobile ? 1 : Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
    }

    // 优化几何体
    optimizeGeometry(geometry) {
        // 合并顶点
        if (geometry.attributes.position) {
            geometry.mergeVertices();
        }

        // 计算边界
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        // 优化索引
        if (geometry.index) {
            geometry.computeVertexNormals();
        }

        // 使用32位索引减少内存
        if (geometry.index && geometry.index.count > 65535) {
            const indices = geometry.index.array;
            const indices32 = new Uint32Array(indices);
            geometry.setIndex(new THREE.BufferAttribute(indices32, 1));
        }
    }

    // 优化材质
    optimizeMaterial(material) {
        const isMobile = this.detectMobile();

        // 移动端降级
        if (isMobile) {
            // 复杂材质转为简单材质
            if (material instanceof THREE.MeshStandardMaterial) {
                const simpleMaterial = new THREE.MeshLambertMaterial({
                    color: material.color,
                    map: material.map,
                    transparent: material.transparent,
                    opacity: material.opacity
                });

                // 释放原材质
                if (material.map) material.map.dispose();
                material.dispose();

                return simpleMaterial;
            }
        }

        // 共享材质属性
        if (!material.defines) {
            material.defines = {};
        }

        return material;
    }

    // 检查内存使用
    checkMemoryUsage() {
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize / 1048576;
            const total = performance.memory.totalJSHeapSize / 1048576;
            const limit = performance.memory.jsHeapSizeLimit / 1048576;

            const usageRatio = used / limit;

            if (usageRatio > this.memoryThreshold) {
                console.warn(`内存使用过高: ${used.toFixed(2)}MB / ${limit.toFixed(2)}MB (${(usageRatio * 100).toFixed(1)}%)`);
                this.forceCleanup();
            }
        }
    }

    // 强制清理
    forceCleanup() {
        console.log('执行强制内存清理...');

        // 清理未使用的纹理
        this.cleanupUnusedTextures();

        // 清理未使用的几何体
        this.cleanupUnusedGeometries();

        // 清理未使用的材质
        this.cleanupUnusedMaterials();

        // 清理渲染器缓存
        if (this.renderer.info) {
            this.renderer.info.reset();
        }

        // 尝试触发垃圾回收
        this.triggerGarbageCollection();
    }

    // 清理未使用的纹理
    cleanupUnusedTextures() {
        const usedTextures = new Set();

        // 遍历场景，记录正在使用的纹理
        this.scene.traverse((object) => {
            if (object.material) {
                if (object.material.map) {
                    usedTextures.add(object.material.map);
                }
                if (object.material.normalMap) {
                    usedTextures.add(object.material.normalMap);
                }
                if (object.material.roughnessMap) {
                    usedTextures.add(object.material.roughnessMap);
                }
                if (object.material.metalnessMap) {
                    usedTextures.add(object.material.metalnessMap);
                }
            }
        });

        // 删除未使用的纹理
        for (const [key, texture] of this.textureCache) {
            if (!usedTextures.has(texture)) {
                texture.dispose();
                this.textureCache.delete(key);
                console.log(`清理纹理: ${key}`);
            }
        }
    }

    // 清理未使用的几何体
    cleanupUnusedGeometries() {
        const usedGeometries = new Set();

        // 遍历场景，记录正在使用的几何体
        this.scene.traverse((object) => {
            if (object.geometry) {
                usedGeometries.add(object.geometry);
            }
        });

        // 删除未使用的几何体
        for (const [key, geometry] of this.geometryCache) {
            if (!usedGeometries.has(geometry)) {
                geometry.dispose();
                this.geometryCache.delete(key);
                console.log(`清理几何体: ${key}`);
            }
        }
    }

    // 清理未使用的材质
    cleanupUnusedMaterials() {
        const usedMaterials = new Set();

        // 遍历场景，记录正在使用的材质
        this.scene.traverse((object) => {
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => usedMaterials.add(m));
                } else {
                    usedMaterials.add(object.material);
                }
            }
        });

        // 删除未使用的材质
        for (const [key, material] of this.materialCache) {
            if (!usedMaterials.has(material)) {
                material.dispose();
                this.materialCache.delete(key);
                console.log(`清理材质: ${key}`);
            }
        }
    }

    // 强制缓存限制
    enforceCacheLimit(cache, limit) {
        if (cache.size > limit) {
            // 获取最早的项目
            const items = Array.from(cache.entries());
            const toRemove = items.slice(0, cache.size - limit);

            toRemove.forEach(([key, value]) => {
                if (value.dispose) {
                    value.dispose();
                }
                cache.delete(key);
            });
        }
    }

    // 触发垃圾回收
    triggerGarbageCollection() {
        // 创建临时对象触发GC
        if (window.gc) {
            window.gc();
        } else {
            // 手动触发
            const objects = [];
            for (let i = 0; i < 1000; i++) {
                objects.push({});
            }
            objects.length = 0;
        }
    }

    // 检测移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
    }

    // 获取内存使用统计
    getMemoryStats() {
        const stats = {
            textures: this.textureCache.size,
            geometries: this.geometryCache.size,
            materials: this.materialCache.size
        };

        if (performance.memory) {
            stats.used = performance.memory.usedJSHeapSize / 1048576;
            stats.total = performance.memory.totalJSHeapSize / 1048576;
            stats.limit = performance.memory.jsHeapSizeLimit / 1048576;
            stats.usageRatio = stats.used / stats.limit;
        }

        return stats;
    }

    // 定期清理
    startPeriodicCleanup() {
        setInterval(() => {
            const now = Date.now();
            if (now - this.lastCleanupTime > this.cleanupInterval) {
                this.checkMemoryUsage();
                this.lastCleanupTime = now;
            }
        }, 5000);
    }

    // 销毁
    destroy() {
        // 清理所有缓存
        this.textureCache.forEach(texture => texture.dispose());
        this.geometryCache.forEach(geometry => geometry.dispose());
        this.materialCache.forEach(material => material.dispose());

        // 清空缓存
        this.textureCache.clear();
        this.geometryCache.clear();
        this.materialCache.clear();
    }
}

// 导出内存优化器
window.MemoryOptimizer = MemoryOptimizer;