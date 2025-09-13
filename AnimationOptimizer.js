// 动画性能优化器
class AnimationOptimizer {
    constructor() {
        this.animations = new Map();
        this.animationQueue = [];
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        this.lastFrameTime = 0;
        this.deltaAccumulator = 0;
        this.isMobile = this.detectMobile();
        this.useWorker = typeof Worker !== 'undefined';
        this.animationWorker = null;
        this.isRunning = false;

        // 移动端限制帧率
        if (this.isMobile) {
            this.targetFPS = 30;
            this.frameInterval = 1000 / 30;
        }

        // 初始化
        this.init();
    }

    // 初始化
    init() {
        // 创建动画Worker
        if (this.useWorker) {
            this.createAnimationWorker();
        }

        // 使用可见性API
        this.setupVisibilityObserver();

        // 使用页面可见性API
        this.setupPageVisibility();
    }

    // 创建动画Worker
    createAnimationWorker() {
        const workerCode = `
            self.onmessage = function(e) {
                const { animations, deltaTime } = e.data;
                const results = {};

                animations.forEach((anim, id) => {
                    // 在Worker中执行动画计算
                    results[id] = calculateAnimation(anim, deltaTime);
                });

                self.postMessage(results);
            };

            function calculateAnimation(anim, deltaTime) {
                // 简单的动画计算示例
                const result = {
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                };

                // 根据动画类型计算
                switch (anim.type) {
                    case 'rotation':
                        result.rotation.y = anim.speed * deltaTime;
                        break;
                    case 'position':
                        result.position.y = Math.sin(Date.now() * 0.001 * anim.speed) * anim.amplitude;
                        break;
                    case 'scale':
                        const scale = 1 + Math.sin(Date.now() * 0.001 * anim.speed) * anim.amplitude;
                        result.scale = { x: scale, y: scale, z: scale };
                        break;
                }

                return result;
            }
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.animationWorker = new Worker(URL.createObjectURL(blob));

        this.animationWorker.onmessage = (e) => {
            const results = e.data;
            Object.keys(results).forEach(id => {
                const anim = this.animations.get(id);
                if (anim && anim.onUpdate) {
                    anim.onUpdate(results[id]);
                }
            });
        };
    }

    // 设置可见性观察者
    setupVisibilityObserver() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const id = entry.target.dataset.animationId;
                    if (id && this.animations.has(id)) {
                        const anim = this.animations.get(id);
                        anim.visible = entry.isIntersecting;
                    }
                });
            }, { threshold: 0.1 });

            this.intersectionObserver = observer;
        }
    }

    // 设置页面可见性
    setupPageVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }

    // 添加动画
    addAnimation(id, config) {
        const animation = {
            id: id,
            type: config.type || 'rotation',
            target: config.target,
            speed: config.speed || 1,
            amplitude: config.amplitude || 1,
            duration: config.duration || Infinity,
            loop: config.loop !== false,
            easing: config.easing || 'linear',
            onStart: config.onStart,
            onUpdate: config.onUpdate,
            onComplete: config.onComplete,
            paused: false,
            visible: true,
            lastTime: 0,
            progress: 0
        };

        this.animations.set(id, animation);

        // 如果有观察者，观察目标
        if (this.intersectionObserver && config.target) {
            config.target.dataset.animationId = id;
            this.intersectionObserver.observe(config.target);
        }

        return id;
    }

    // 移除动画
    removeAnimation(id) {
        const anim = this.animations.get(id);
        if (anim) {
            if (this.intersectionObserver && anim.target) {
                this.intersectionObserver.unobserve(anim.target);
            }
            this.animations.delete(id);
        }
    }

    // 暂停动画
    pauseAnimation(id) {
        const anim = this.animations.get(id);
        if (anim) {
            anim.paused = true;
        }
    }

    // 恢复动画
    resumeAnimation(id) {
        const anim = this.animations.get(id);
        if (anim) {
            anim.paused = false;
            anim.lastTime = performance.now();
        }
    }

    // 暂停所有动画
    pause() {
        this.isRunning = false;
        if (this.animationWorker) {
            this.animationWorker.postMessage({ type: 'pause' });
        }
    }

    // 恢复所有动画
    resume() {
        this.isRunning = true;
        if (this.animationWorker) {
            this.animationWorker.postMessage({ type: 'resume' });
        }
    }

    // 更新动画
    update(deltaTime) {
        if (!this.isRunning) return;

        // 使用Worker进行批量计算
        if (this.animationWorker && this.animations.size > 5) {
            const workerAnimations = new Map();
            this.animations.forEach((anim, id) => {
                if (!anim.paused && anim.visible) {
                    workerAnimations.set(id, {
                        type: anim.type,
                        speed: anim.speed,
                        amplitude: anim.amplitude
                    });
                }
            });

            if (workerAnimations.size > 0) {
                this.animationWorker.postMessage({
                    animations: workerAnimations,
                    deltaTime: deltaTime
                });
            }
        } else {
            // 主线程更新
            this.animations.forEach((anim, id) => {
                if (!anim.paused && anim.visible) {
                    this.updateAnimation(anim, deltaTime);
                }
            });
        }
    }

    // 更新单个动画
    updateAnimation(anim, deltaTime) {
        if (anim.paused) return;

        // 更新进度
        if (anim.duration !== Infinity) {
            anim.progress += deltaTime / anim.duration * 1000;
            if (anim.progress >= 100) {
                if (anim.loop) {
                    anim.progress = anim.progress % 100;
                } else {
                    anim.progress = 100;
                    if (anim.onComplete) {
                        anim.onComplete();
                    }
                    return;
                }
            }
        }

        // 计算动画值
        const t = this.applyEasing(anim.progress / 100, anim.easing);
        const value = this.calculateAnimationValue(anim, t);

        // 应用到目标
        if (anim.target && anim.onUpdate) {
            anim.onUpdate(value);
        }
    }

    // 应用缓动函数
    applyEasing(t, easing) {
        switch (easing) {
            case 'linear':
                return t;
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return t * (2 - t);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            case 'bounce':
                if (t < 1 / 2.75) {
                    return 7.5625 * t * t;
                } else if (t < 2 / 2.75) {
                    return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
                } else if (t < 2.5 / 2.75) {
                    return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
                } else {
                    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
                }
            default:
                return t;
        }
    }

    // 计算动画值
    calculateAnimationValue(anim, t) {
        const result = {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        };

        switch (anim.type) {
            case 'rotation':
                result.rotation.y = t * Math.PI * 2 * anim.speed;
                break;
            case 'position':
                result.position.y = Math.sin(t * Math.PI * 2 * anim.speed) * anim.amplitude;
                break;
            case 'scale':
                const scale = 1 + Math.sin(t * Math.PI * 2 * anim.speed) * anim.amplitude;
                result.scale = { x: scale, y: scale, z: scale };
                break;
            case 'fade':
                result.opacity = t;
                break;
        }

        return result;
    }

    // 创建优化的动画循环
    createAnimationLoop(callback) {
        let lastTime = 0;
        let accumulatedTime = 0;

        const loop = (currentTime) => {
            // 计算增量时间
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            // 帧率限制
            if (deltaTime < this.frameInterval) {
                requestAnimationFrame(loop);
                return;
            }

            // 固定时间步长更新
            accumulatedTime += deltaTime;
            const fixedStep = 1000 / this.targetFPS;

            while (accumulatedTime >= fixedStep) {
                this.update(fixedStep);
                accumulatedTime -= fixedStep;
            }

            // 渲染
            if (callback) {
                callback();
            }

            requestAnimationFrame(loop);
        };

        return requestAnimationFrame(loop);
    }

    // 使用requestIdleCallback进行非关键动画
    scheduleIdleAnimation(callback) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { timeout: 1000 });
        } else {
            setTimeout(callback, 16);
        }
    }

    // 批量更新动画属性
    batchUpdate(updates) {
        // 创建更新批处理
        const batch = [];

        updates.forEach(update => {
            const anim = this.animations.get(update.id);
            if (anim && !anim.paused) {
                batch.push({
                    id: update.id,
                    property: update.property,
                    value: update.value
                });
            }
        });

        // 一次性应用所有更新
        batch.forEach(item => {
            const anim = this.animations.get(item.id);
            if (anim && anim.target) {
                anim.target[item.property] = item.value;
            }
        });
    }

    // 使用CSS动画代替JS动画
    useCSSAnimation(element, animation) {
        if (element && element.style) {
            element.style.animation = `${animation.name} ${animation.duration}ms ${animation.easing} ${animation.iteration} ${animation.direction}`;
        }
    }

    // 获取动画统计
    getStats() {
        let activeAnimations = 0;
        let pausedAnimations = 0;
        let visibleAnimations = 0;

        this.animations.forEach(anim => {
            if (!anim.paused) activeAnimations++;
            else pausedAnimations++;
            if (anim.visible) visibleAnimations++;
        });

        return {
            total: this.animations.size,
            active: activeAnimations,
            paused: pausedAnimations,
            visible: visibleAnimations,
            targetFPS: this.targetFPS,
            usingWorker: !!this.animationWorker
        };
    }

    // 检测移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints > 1);
    }

    // 销毁
    destroy() {
        // 停止Worker
        if (this.animationWorker) {
            this.animationWorker.terminate();
        }

        // 停止观察者
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }

        // 清理动画
        this.animations.clear();
        this.animationQueue = [];
    }
}

// 导出动画优化器
window.AnimationOptimizer = AnimationOptimizer;