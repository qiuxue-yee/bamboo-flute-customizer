// 代理集成系统 - 集成所有优化代理并协调工作
class AgentIntegration {
    constructor(mainApp) {
        this.mainApp = mainApp;
        this.coordinator = new AgentCoordinator();
        this.isInitialized = false;

        // 初始化代理配置
        this.agentConfigs = {
            animation: {
                priority: 0.8,
                criteria: {
                    performance: true,
                    reliability: true,
                    resourceUsage: true,
                    compatibility: true
                }
            },
            gpu: {
                priority: 0.9,
                criteria: {
                    performance: true,
                    reliability: true,
                    resourceUsage: true,
                    compatibility: true
                }
            },
            memory: {
                priority: 0.7,
                criteria: {
                    performance: true,
                    reliability: true,
                    resourceUsage: true,
                    compatibility: true
                }
            },
            mobile: {
                priority: 0.85,
                criteria: {
                    performance: true,
                    reliability: true,
                    resourceUsage: true,
                    compatibility: true
                }
            }
        };

        // 启动集成
        this.init();
    }

    // 初始化集成系统
    init() {
        console.log('初始化代理集成系统...');

        // 注册所有代理
        this.registerAgents();

        // 设置代理优先级
        this.setupAgentPriorities();

        // 启动代理协调器
        this.coordinator.startAllAgents();

        this.isInitialized = true;
        console.log('代理集成系统初始化完成');
    }

    // 注册所有优化代理
    registerAgents() {
        // 注册动画优化器
        if (this.mainApp.animationOptimizer) {
            this.coordinator.registerAgent('animation', this.mainApp.animationOptimizer, [
                'animation_performance',
                'frame_rate_control',
                'memory_optimization',
                'batch_processing'
            ]);
        }

        // 注册GPU优化器
        if (this.mainApp.gpuOptimizer) {
            this.coordinator.registerAgent('gpu', this.mainApp.gpuOptimizer, [
                'render_optimization',
                'material_batching',
                'instancing',
                'shadow_optimization'
            ]);
        }

        // 注册内存优化器
        if (this.mainApp.memoryOptimizer) {
            this.coordinator.registerAgent('memory', this.mainApp.memoryOptimizer, [
                'memory_management',
                'texture_cache',
                'geometry_optimization',
                'garbage_collection'
            ]);
        }

        // 注册移动端优化器
        if (this.mainApp.mobileOptimizer) {
            this.coordinator.registerAgent('mobile', this.mainApp.mobileOptimizer, [
                'mobile_detection',
                'performance_adaptation',
                'power_saving',
                'touch_optimization'
            ]);
        }

        console.log(`已注册 ${this.coordinator.agents.size} 个优化代理`);
    }

    // 设置代理优先级
    setupAgentPriorities() {
        Object.entries(this.agentConfigs).forEach(([agentId, config]) => {
            if (this.coordinator.agents.has(agentId)) {
                this.coordinator.establishPriority(agentId, config.criteria);
            }
        });

        console.log('代理优先级设置完成');
    }

    // 运行优化协调流程
    runOptimizationCycle() {
        if (!this.isInitialized) {
            console.warn('代理集成系统未初始化');
            return;
        }

        console.log('开始优化协调流程...');

        try {
            // 1. 收集所有代理的审查结果
            const results = this.coordinator.collectAgentResults();
            console.log(`收集到 ${results.size} 个代理结果`);

            // 2. 识别冲突和建议
            const conflicts = this.coordinator.identifyConflicts();
            console.log(`检测到 ${conflicts.length} 个冲突`);

            // 3. 生成统一的优化方案
            const plan = this.coordinator.generateUnifiedPlan();
            if (plan) {
                console.log(`生成优化方案，包含 ${plan.actions.length} 个动作`);
            }

            // 4. 执行优化方案
            if (plan && this.coordinator.executeOptimizationPlan()) {
                console.log('优化方案执行成功');
            }

            // 5. 确保一致性
            if (this.coordinator.ensureConsistency()) {
                console.log('一致性检查通过');
            }

            // 6. 记录优化结果
            this.logOptimizationResults();

            return plan;

        } catch (error) {
            console.error('优化协调流程失败:', error);
            return null;
        }
    }

    // 获取系统统计信息
    getSystemStats() {
        return this.coordinator.getSystemStats();
    }

    // 获取代理状态
    getAgentStatus(agentId) {
        return this.coordinator.getAgentStatus(agentId);
    }

    // 手动调整代理优先级
    adjustAgentPriority(agentId, criteria) {
        if (this.coordinator.agents.has(agentId)) {
            this.coordinator.establishPriority(agentId, criteria);
            console.log(`代理 ${agentId} 优先级已调整`);
        } else {
            console.warn(`代理不存在: ${agentId}`);
        }
    }

    // 强制重新优化
    forceReoptimize() {
        console.log('强制重新优化...');

        // 停止所有代理
        this.coordinator.stopAllAgents();

        // 等待一段时间
        setTimeout(() => {
            // 重新启动
            this.coordinator.startAllAgents();

            // 立即运行优化流程
            this.runOptimizationCycle();
        }, 1000);
    }

    // 监控系统性能
    startPerformanceMonitoring() {
        setInterval(() => {
            const stats = this.getSystemStats();

            // 检查系统状态
            if (stats.results.resolvedConflicts < stats.results.totalConflicts * 0.8) {
                console.warn('冲突解决率较低，建议手动干预');
            }

            if (stats.optimization.planScore < 0.6) {
                console.warn('优化执行成功率较低，建议重新优化');
            }

            // 输出性能统计
            if (Math.random() < 0.1) { // 10% 概率输出详细统计
                console.log('系统性能统计:', {
                    activeAgents: stats.agents.active,
                    conflicts: stats.conflicts.unresolved,
                    optimizationScore: stats.optimization.planScore,
                    lastOptimization: stats.optimization.lastOptimization
                });
            }
        }, 30000); // 每30秒检查一次
    }

    // 记录优化结果
    logOptimizationResults() {
        const stats = this.getSystemStats();

        const logEntry = {
            timestamp: Date.now(),
            stats: stats,
            conflicts: this.coordinator.conflicts,
            plan: this.coordinator.optimizationPlan
        };

        // 这里可以添加将结果保存到数据库或文件的逻辑
        console.log('优化结果已记录:', logEntry);

        // 检查是否需要调整策略
        this.checkAndAdjustStrategy(logEntry);
    }

    // 检查并调整策略
    checkAndAdjustStrategy(logEntry) {
        const stats = logEntry.stats;

        // 如果优化成功率低，调整策略
        if (stats.optimization.planScore < 0.5) {
            console.log('优化成功率过低，调整策略...');

            // 增加内存优化器的优先级
            if (this.coordinator.agents.has('memory')) {
                const newCriteria = {
                    performance: true,
                    reliability: true,
                    resourceUsage: true,
                    compatibility: true
                };
                this.adjustAgentPriority('memory', newCriteria);
            }
        }

        // 如果冲突较多，加强一致性检查
        if (stats.conflicts.unresolved > 3) {
            console.log('冲突较多，加强一致性检查...');
            this.coordinator.ensureConsistency();
        }
    }

    // 处理代理故障
    handleAgentFailure(agentId) {
        console.warn(`检测到代理故障: ${agentId}`);

        // 停止故障代理
        this.coordinator.stopAgent(agentId);

        // 尝试重新启动
        setTimeout(() => {
            console.log(`尝试重启代理: ${agentId}`);
            this.coordinator.startAgent(agentId);
        }, 5000);

        // 记录故障
        this.logAgentFailure(agentId);
    }

    // 记录代理故障
    logAgentFailure(agentId) {
        const failureEntry = {
            timestamp: Date.now(),
            agentId: agentId,
            failureType: 'unknown',
            previousState: this.coordinator.agents.get(agentId) || null
        };

        console.log('代理故障记录:', failureEntry);
    }

    // 暂停特定代理
    pauseAgent(agentId) {
        const agentInfo = this.coordinator.agents.get(agentId);
        if (agentInfo) {
            agentInfo.isActive = false;
            this.coordinator.stopAgent(agentId);
            console.log(`代理已暂停: ${agentId}`);
        }
    }

    // 恢复特定代理
    resumeAgent(agentId) {
        const agentInfo = this.coordinator.agents.get(agentId);
        if (agentInfo) {
            agentInfo.isActive = true;
            this.coordinator.startAgent(agentId);
            console.log(`代理已恢复: ${agentId}`);
        }
    }

    // 应用统一配置
    applyUnifiedConfiguration(config) {
        console.log('应用统一配置...');

        this.coordinator.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.agent.updateConfiguration) {
                try {
                    agentInfo.agent.updateConfiguration(config);
                    console.log(`配置已应用到代理: ${agentId}`);
                } catch (error) {
                    console.error(`配置应用失败 ${agentId}:`, error);
                }
            }
        });
    }

    // 执行特定代理的优化
    runAgentOptimization(agentId, specificConfig = null) {
        const agentInfo = this.coordinator.agents.get(agentId);
        if (agentInfo) {
            if (specificConfig) {
                this.coordinator.updateConfiguration(agentId, specificConfig);
            }
            this.coordinator.startAgent(agentId);
            console.log(`已执行代理优化: ${agentId}`);
        }
    }

    // 获取冲突详情
    getConflictDetails() {
        return this.coordinator.conflicts;
    }

    // 手动解决冲突
    manuallyResolveConflict(conflictIndex, resolution) {
        if (this.coordinator.conflicts[conflictIndex]) {
            this.coordinator.conflicts[conflictIndex].resolution = resolution;
            this.coordinator.conflicts[conflictIndex].manuallyResolved = true;
            this.coordinator.conflicts[conflictIndex].resolutionTime = Date.now();
            console.log(`冲突已手动解决: ${conflictIndex} - ${resolution}`);
        } else {
            console.warn(`冲突不存在: ${conflictIndex}`);
        }
    }

    // 导出系统配置
    exportConfiguration() {
        const config = {
            agentConfigs: this.agentConfigs,
            systemConfig: this.coordinator.config,
            currentStats: this.getSystemStats(),
            priorities: Array.from(this.coordinator.priorityScores.entries())
        };

        console.log('系统配置已导出:', config);
        return config;
    }

    // 导入系统配置
    importConfiguration(config) {
        try {
            this.agentConfigs = config.agentConfigs;
            this.coordinator.config = config.systemConfig;

            // 重新设置优先级
            Object.entries(this.agentConfigs).forEach(([agentId, agentConfig]) => {
                if (this.coordinator.agents.has(agentId)) {
                    this.coordinator.establishPriority(agentId, agentConfig.criteria);
                }
            });

            console.log('系统配置已导入');
            return true;
        } catch (error) {
            console.error('配置导入失败:', error);
            return false;
        }
    }

    // 销毁集成系统
    destroy() {
        console.log('销毁代理集成系统...');

        this.coordinator.destroy();
        this.coordinator = null;
        this.isInitialized = false;

        console.log('代理集成系统已销毁');
    }
}

// 性能监控器
class PerformanceMonitor {
    constructor(integration) {
        this.integration = integration;
        this.metrics = {
            fps: [],
            memory: [],
            conflicts: [],
            optimizationScore: []
        };
        this.isMonitoring = false;
    }

    // 开始监控
    start() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
            this.analyzePerformance();
        }, 5000);

        console.log('性能监控已启动');
    }

    // 停止监控
    stop() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        clearInterval(this.monitoringInterval);
        console.log('性能监控已停止');
    }

    // 收集性能指标
    collectMetrics() {
        const stats = this.integration.getSystemStats();

        // 收集FPS
        if (window.performance && performance.now) {
            const now = performance.now();
            if (this.lastFrameTime) {
                const fps = 1000 / (now - this.lastFrameTime);
                this.metrics.fps.push(fps);
                if (this.metrics.fps.length > 60) {
                    this.metrics.fps.shift();
                }
            }
            this.lastFrameTime = now;
        }

        // 收集内存使用
        if (performance.memory) {
            this.metrics.memory.push(performance.memory.usedJSHeapSize / 1048576);
            if (this.metrics.memory.length > 60) {
                this.metrics.memory.shift();
            }
        }

        // 收集冲突数量
        this.metrics.conflicts.push(this.integration.coordinator.conflicts.length);
        if (this.metrics.conflicts.length > 60) {
            this.metrics.conflicts.shift();
        }

        // 收集优化得分
        this.metrics.optimizationScore.push(stats.optimization.planScore);
        if (this.metrics.optimizationScore.length > 60) {
            this.metrics.optimizationScore.shift();
        }
    }

    // 分析性能
    analyzePerformance() {
        const analysis = {
            fps: this.analyzeFPS(),
            memory: this.analyzeMemory(),
            conflicts: this.analyzeConflicts(),
            overall: this.calculateOverallScore()
        };

        // 根据分析结果调整系统
        if (analysis.overall < 0.7) {
            console.warn('性能分析显示系统性能下降，建议调整');
            this.integration.forceReoptimize();
        }

        return analysis;
    }

    analyzeFPS() {
        if (this.metrics.fps.length === 0) return 1.0;

        const avgFPS = this.metrics.fps.reduce((a, b) => a + b, 0) / this.metrics.fps.length;
        return Math.min(avgFPS / 60, 1.0); // 60FPS为理想值
    }

    analyzeMemory() {
        if (this.metrics.memory.length === 0) return 1.0;

        const avgMemory = this.metrics.memory.reduce((a, b) => a + b, 0) / this.metrics.memory.length;
        return Math.max(0, 1.0 - (avgMemory / 1000)); // 1000MB为阈值
    }

    analyzeConflicts() {
        if (this.metrics.conflicts.length === 0) return 1.0;

        const avgConflicts = this.metrics.conflicts.reduce((a, b) => a + b, 0) / this.metrics.conflicts.length;
        return Math.max(0, 1.0 - (avgConflicts / 10)); // 10个冲突为阈值
    }

    calculateOverallScore() {
        const fps = this.analyzeFPS();
        const memory = this.analyzeMemory();
        const conflicts = this.analyzeConflicts();

        return (fps + memory + conflicts) / 3;
    }
}

// 导出代理集成系统
window.AgentIntegration = AgentIntegration;
window.PerformanceMonitor = PerformanceMonitor;