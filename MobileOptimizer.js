// 移动端性能适配器
class MobileOptimizer {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.isMobile = this.detectMobile();
        this.isTablet = this.detectTablet();
        this.isLowEndDevice = this.detectLowEndDevice();
        this.performanceLevel = this.getPerformanceLevel();
        this.optimizationProfile = this.createOptimizationProfile();

        // 初始化移动端优化
        if (this.isMobile) {
            this.initMobileOptimizations();
        }
    }

    // 检测移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
    }

    // 检测平板
    detectTablet() {
        const userAgent = navigator.userAgent;
        return /iPad|Tablet|Nexus 7|Nexus 9|Nexus 10|SM-T|GT-P|SGP6|SCH-I800/i.test(userAgent) ||
               (this.isMobile && window.innerWidth > 768);
    }

    // 检测低端设备
    detectLowEndDevice() {
        // 简单的检测逻辑
        const isOldDevice = /iPhone OS [6-9]/.test(navigator.userAgent);
        const isLowMemory = navigator.deviceMemory < 4;
        const isLowCores = navigator.hardwareConcurrency < 4;

        return isOldDevice || isLowMemory || isLowCores;
    }

    // 获取性能级别
    getPerformanceLevel() {
        if (!this.isMobile) return 'high';
        if (this.isTablet) return 'medium';
        if (this.isLowEndDevice) return 'low';
        return 'medium';
    }

    // 创建优化配置
    createOptimizationProfile() {
        const profiles = {
            high: {
                pixelRatio: Math.min(window.devicePixelRatio, 2),
                shadowMap: true,
                shadowQuality: 'high',
                antialias: true,
                textureSize: 1024,
                particleCount: 1000,
                lightCount: 5,
                postProcessing: true,
                fpsLimit: 60
            },
            medium: {
                pixelRatio: 1.5,
                shadowMap: true,
                shadowQuality: 'medium',
                antialias: false,
                textureSize: 512,
                particleCount: 500,
                lightCount: 3,
                postProcessing: false,
                fpsLimit: 30
            },
            low: {
                pixelRatio: 1,
                shadowMap: false,
                shadowQuality: 'low',
                antialias: false,
                textureSize: 256,
                particleCount: 100,
                lightCount: 2,
                postProcessing: false,
                fpsLimit: 15
            }
        };

        return profiles[this.performanceLevel];
    }

    // 初始化移动端优化
    initMobileOptimizations() {
        console.log(`移动端优化启动 - 性能级别: ${this.performanceLevel}`);

        // 应用渲染器优化
        this.optimizeRenderer();

        // 优化相机设置
        this.optimizeCamera();

        // 优化场景
        this.optimizeScene();

        // 添加触摸优化
        this.setupTouchOptimization();

        // 添加方向变化处理
        this.setupOrientationHandling();

        // 添加省电模式
        this.setupPowerSaving();

        // 添加性能监控
        this.setupPerformanceMonitoring();
    }

    // 优化渲染器
    optimizeRenderer() {
        const profile = this.optimizationProfile;

        // 设置像素比
        this.renderer.setPixelRatio(profile.pixelRatio);

        // 抗锯齿
        this.renderer.domElement.style.imageRendering = profile.antialias ? 'auto' : 'crisp-edges';

        // 阴影设置
        if (!profile.shadowMap) {
            this.renderer.shadowMap.enabled = false;
        } else {
            this.renderer.shadowMap.type = {
                high: THREE.PCFSoftShadowMap,
                medium: THREE.PCFShadowMap,
                low: THREE.BasicShadowMap
            }[profile.shadowQuality];
        }

        // 禁用不必要的缓冲区
        this.renderer.getContext().getExtension('WEBGL_lose_context');
    }

    // 优化相机
    optimizeCamera() {
        // 移动端使用更宽的视野
        if (this.isMobile && !this.isTablet) {
            this.camera.fov = 60;
            this.camera.updateProjectionMatrix();
        }

        // 添加触摸缩放限制
        if (this.camera.userData.controls) {
            this.camera.userData.controls.minDistance = 50;
            this.camera.userData.controls.maxDistance = 300;
            this.camera.userData.controls.enablePan = false;
        }
    }

    // 优化场景
    optimizeScene() {
        const profile = this.optimizationProfile;

        // 简化材质
        this.scene.traverse((object) => {
            if (object.material) {
                this.simplifyMaterial(object.material, profile);
            }
        });

        // 减少光照
        this.optimizeLights(profile.lightCount);

        // 简化几何体
        this.simplifyGeometries();

        // 添加雾效以遮挡远处物体
        if (this.isLowEndDevice) {
            this.scene.fog = new THREE.Fog(0xf0f2f5, 50, 200);
        }
    }

    // 简化材质
    simplifyMaterial(material, profile) {
        if (this.isLowEndDevice) {
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

        // 优化纹理
        if (material.map) {
            material.map.anisotropy = 1;
            material.map.generateMipmaps = false;
            material.map.minFilter = THREE.LinearFilter;
        }

        return material;
    }

    // 优化光照
    optimizeLights(maxLights) {
        const lights = [];

        // 收集所有光源
        this.scene.traverse((object) => {
            if (object.isLight && !(object instanceof THREE.AmbientLight)) {
                lights.push(object);
            }
        });

        // 移除多余的光源
        if (lights.length > maxLights) {
            lights.slice(maxLights).forEach(light => {
                this.scene.remove(light);
            });
        }
    }

    // 简化几何体
    simplifyGeometries() {
        if (this.isLowEndDevice) {
            this.scene.traverse((object) => {
                if (object.geometry && object.geometry.attributes.position) {
                    // 减少细节
                    const positions = object.geometry.attributes.position.array;
                    const newCount = Math.floor(positions.length / 3 * 0.5);

                    // 这里应该使用简化的算法
                    // 例如使用THREE.SimplifyModifier
                }
            });
        }
    }

    // 设置触摸优化
    setupTouchOptimization() {
        // 添加触摸反馈
        document.addEventListener('touchstart', (e) => {
            // 防止默认行为
            if (e.target.tagName === 'CANVAS') {
                e.preventDefault();
            }
        }, { passive: false });

        // 优化触摸响应
        let lastTouchTime = 0;
        const touchDebounce = 100;

        document.addEventListener('touchmove', (e) => {
            const now = Date.now();
            if (now - lastTouchTime < touchDebounce) {
                return;
            }
            lastTouchTime = now;

            // 处理触摸移动
            this.handleTouchMove(e);
        }, { passive: true });
    }

    // 处理触摸移动
    handleTouchMove(event) {
        if (event.touches.length === 1) {
            // 单指旋转
            const touch = event.touches[0];
            // 更新控制器
        } else if (event.touches.length === 2) {
            // 双指缩放
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            // 更新缩放
        }
    }

    // 设置方向变化处理
    setupOrientationHandling() {
        window.addEventListener('orientationchange', () => {
            // 延迟处理以确保方向变化完成
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
    }

    // 处理方向变化
    handleOrientationChange() {
        // 更新相机宽高比
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();

        // 更新渲染器大小
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // 根据方向调整优化策略
        const isLandscape = window.innerWidth > window.innerHeight;
        this.adjustOptimizationForOrientation(isLandscape);
    }

    // 根据方向调整优化
    adjustOptimizationForOrientation(isLandscape) {
        if (isLandscape) {
            // 横屏模式可以稍微提高质量
            if (this.performanceLevel === 'medium') {
                this.renderer.shadowMap.enabled = true;
            }
        } else {
            // 竖屏模式进一步优化
            if (this.performanceLevel === 'medium') {
                this.renderer.shadowMap.enabled = false;
            }
        }
    }

    // 设置省电模式
    setupPowerSaving() {
        // 监听电池状态
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                battery.addEventListener('chargingchange', () => {
                    this.handleBatteryChange(battery);
                });

                battery.addEventListener('levelchange', () => {
                    this.handleBatteryChange(battery);
                });
            });
        }
    }

    // 处理电池变化
    handleBatteryChange(battery) {
        if (battery.charging) {
            // 充电时恢复正常性能
            this.restorePerformance();
        } else if (battery.level < 0.2) {
            // 低电量时启用省电模式
            this.enablePowerSaving();
        }
    }

    // 启用省电模式
    enablePowerSaving() {
        console.log('启用省电模式');
        this.renderer.shadowMap.enabled = false;
        this.targetFPS = 15;

        // 降低渲染质量
        this.scene.traverse((object) => {
            if (object.material) {
                object.material.wireframe = false;
            }
        });
    }

    // 恢复性能
    restorePerformance() {
        console.log('恢复正常性能');
        const profile = this.optimizationProfile;
        this.renderer.shadowMap.enabled = profile.shadowMap;
        this.targetFPS = profile.fpsLimit;
    }

    // 设置性能监控
    setupPerformanceMonitoring() {
        // 监控帧率
        let lastTime = performance.now();
        let frames = 0;

        const monitorFrame = () => {
            frames++;
            const currentTime = performance.now();

            if (currentTime >= lastTime + 1000) {
                const fps = Math.round((frames * 1000) / (currentTime - lastTime));

                // 根据FPS动态调整
                if (fps < this.optimizationProfile.fpsLimit * 0.8) {
                    this.degradePerformance();
                } else if (fps > this.optimizationProfile.fpsLimit * 0.9 && this.performanceLevel === 'low') {
                    this.improvePerformance();
                }

                frames = 0;
                lastTime = currentTime;
            }

            requestAnimationFrame(monitorFrame);
        };

        monitorFrame();
    }

    // 降低性能
    degradePerformance() {
        if (this.performanceLevel === 'medium') {
            this.renderer.shadowMap.enabled = false;
        } else if (this.performanceLevel === 'low') {
            // 进一步降低
            this.scene.traverse((object) => {
                if (object.material && object.material.map) {
                    object.material.map = null;
                }
            });
        }
    }

    // 提高性能
    improvePerformance() {
        const profile = this.optimizationProfile;
        if (this.performanceLevel === 'low' && profile.shadowMap) {
            this.renderer.shadowMap.enabled = true;
        }
    }

    // 获取设备信息
    getDeviceInfo() {
        return {
            isMobile: this.isMobile,
            isTablet: this.isTablet,
            isLowEndDevice: this.isLowEndDevice,
            performanceLevel: this.performanceLevel,
            pixelRatio: window.devicePixelRatio,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            deviceMemory: navigator.deviceMemory || 'unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
        };
    }

    // 获取优化统计
    getOptimizationStats() {
        return {
            profile: this.optimizationProfile,
            shadowsEnabled: this.renderer.shadowMap.enabled,
            pixelRatio: this.renderer.getPixelRatio(),
            drawCalls: this.renderer.info.render.calls,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize / 1048576,
                total: performance.memory.totalJSHeapSize / 1048576
            } : null
        };
    }
}

// 导出移动端优化器
window.MobileOptimizer = MobileOptimizer;