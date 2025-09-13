// 代理协调系统演示脚本
class AgentCoordinationDemo {
    constructor() {
        this.diziApp = null;
        this.isRunning = false;
        this.demoInterval = null;
    }

    // 初始化演示
    init() {
        console.log('初始化代理协调系统演示...');

        // 检查应用是否已加载
        if (typeof app !== 'undefined') {
            this.diziApp = app;
            this.startDemo();
        } else {
            // 等待应用加载完成
            this.waitForApp();
        }
    }

    // 等待应用加载
    waitForApp() {
        const checkInterval = setInterval(() => {
            if (typeof app !== 'undefined') {
                this.diziApp = app;
                clearInterval(checkInterval);
                this.startDemo();
            }
        }, 100);

        // 超时处理
        setTimeout(() => {
            clearInterval(checkInterval);
            console.error('等待应用加载超时');
        }, 10000);
    }

    // 启动演示
    startDemo() {
        console.log('开始代理协调系统演示...');

        this.isRunning = true;

        // 显示初始状态
        this.showInitialStatus();

        // 启动演示流程
        this.startDemoWorkflow();

        // 启动用户界面更新
        this.startUIUpdate();
    }

    // 显示初始状态
    showInitialStatus() {
        console.log('=== 代理协调系统初始状态 ===');
        const status = this.diziApp.getSystemStatus();
        if (status) {
            console.log('代理数量:', status.agents.total);
            console.log('活跃代理:', status.agents.active);
            console.log('优先级配置:', status.priorities);
        }
    }

    // 启动演示工作流
    startDemoWorkflow() {
        // 阶段1: 代理初始化
        this.demoInterval = setInterval(() => {
            this.runDemoStep();
        }, 15000); // 每15秒一个步骤
    }

    // 运行演示步骤
    runDemoStep() {
        if (!this.isRunning) return;

        const stepNumber = this.getCurrentStepNumber();
        console.log(`\n=== 演示步骤 ${stepNumber} ===`);

        switch (stepNumber) {
            case 1:
                this.stepCollectResults();
                break;
            case 2:
                this.stepDetectConflicts();
                break;
            case 3:
                this.stepGeneratePlan();
                break;
            case 4:
                this.stepExecutePlan();
                break;
            case 5:
                this.stepCheckConsistency();
                break;
            case 6:
                this.stepAdjustPriorities();
                break;
            case 7:
                this.stepPerformanceAnalysis();
                break;
            case 8:
                this.stepManualOptimization();
                break;
            default:
                this.stepReset();
                break;
        }
    }

    // 获取当前步骤编号
    getCurrentStepNumber() {
        const now = Date.now();
        const startTime = this.diziApp.initTime || now;
        const elapsed = now - startTime;
        const stepNumber = Math.floor(elapsed / 15000) % 8 + 1;
        return stepNumber;
    }

    // 步骤1: 收集代理结果
    stepCollectResults() {
        console.log('步骤1: 收集所有代理的审查结果');

        if (this.diziApp.agentIntegration) {
            const stats = this.diziApp.agentIntegration.getSystemStats();
            console.log('收集到的结果:', {
                animation: this.diziApp.animationOptimizer?.getStats(),
                gpu: this.diziApp.gpuOptimizer?.getGPUStats(),
                memory: this.diziApp.memoryOptimizer?.getMemoryStats(),
                mobile: this.diziApp.mobileOptimizer?.getOptimizationStats()
            });
        }
    }

    // 步骤2: 检测冲突
    stepDetectConflicts() {
        console.log('步骤2: 识别冲突和建议');

        if (this.diziApp.agentIntegration) {
            const conflicts = this.diziApp.agentIntegration.getConflictDetails();
            console.log('检测到的冲突:', conflicts.length);

            if (conflicts.length > 0) {
                console.log('冲突详情:');
                conflicts.forEach((conflict, index) => {
                    console.log(`冲突${index + 1}:`, conflict);
                });
            }
        }
    }

    // 步骤3: 生成优化方案
    stepGeneratePlan() {
        console.log('步骤3: 生成统一的优化方案');

        if (this.diziApp.agentIntegration) {
            const plan = this.diziApp.agentIntegration.runOptimizationCycle();
            if (plan) {
                console.log('生成的优化方案:', {
                    actions: plan.actions.length,
                    improvement: plan.estimatedImprovement
                });
            }
        }
    }

    // 步骤4: 执行优化方案
    stepExecutePlan() {
        console.log('步骤4: 执行优化方案');

        if (this.diziApp.agentIntegration) {
            this.diziApp.triggerOptimization();
            console.log('优化方案执行请求已发送');
        }
    }

    // 步骤5: 检查一致性
    stepCheckConsistency() {
        console.log('步骤5: 确保系统一致性');

        if (this.diziApp.agentIntegration) {
            const stats = this.diziApp.agentIntegration.getSystemStats();
            console.log('系统一致性状态:', {
                activeAgents: stats.agents.active,
                conflicts: stats.conflicts.unresolved,
                optimizationScore: stats.optimization.planScore
            });
        }
    }

    // 步骤6: 调整优先级
    stepAdjustPriorities() {
        console.log('步骤6: 动态调整代理优先级');

        if (this.diziApp.agentIntegration) {
            // 模拟基于性能的优先级调整
            const randomAgent = ['animation', 'gpu', 'memory', 'mobile'][Math.floor(Math.random() * 4)];
            const newCriteria = {
                performance: Math.random() > 0.5,
                reliability: Math.random() > 0.3,
                resourceUsage: Math.random() > 0.4,
                compatibility: Math.random() > 0.6
            };

            this.diziApp.agentIntegration.adjustAgentPriority(randomAgent, newCriteria);
            console.log(`已调整 ${randomAgent} 代理的优先级`);
        }
    }

    // 步骤7: 性能分析
    stepPerformanceAnalysis() {
        console.log('步骤7: 系统性能分析');

        if (this.diziApp.agentIntegration) {
            const stats = this.diziApp.agentIntegration.getSystemStats();
            console.log('性能分析结果:', {
                fps: stats.optimization.planScore * 60,
                memory: stats.optimization.planScore * 1000,
                throughput: stats.agents.active,
                efficiency: stats.optimization.planScore
            });
        }
    }

    // 步骤8: 手动优化
    stepManualOptimization() {
        console.log('步骤8: 手动触发优化');

        // 模拟用户手动触发优化
        console.log('用户触发特定代理优化...');
        const randomAgent = ['animation', 'gpu', 'memory', 'mobile'][Math.floor(Math.random() * 4)];

        if (this.diziApp.agentIntegration) {
            const specificConfig = {
                [randomAgent]: {
                    targetFPS: [30, 45, 60][Math.floor(Math.random() * 3)],
                    quality: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
                }
            };

            this.diziApp.agentIntegration.runAgentOptimization(randomAgent, specificConfig);
            console.log(`已手动优化 ${randomAgent} 代理`);
        }
    }

    // 重置演示
    stepReset() {
        console.log('重置演示...');
        // 重置到第一个步骤
    }

    // 启动UI更新
    startUIUpdate() {
        // 每秒更新一次UI
        this.uiInterval = setInterval(() => {
            this.updateUI();
        }, 1000);
    }

    // 更新UI
    updateUI() {
        if (!this.isRunning || !this.diziApp.agentIntegration) return;

        const stats = this.diziApp.agentIntegration.getSystemStats();
        const currentTime = new Date().toLocaleTimeString();

        // 更新控制台输出（简化的状态信息）
        console.log(`[${currentTime}] 系统状态: 活跃代理=${stats.agents.active}, 冲突=${stats.conflicts.unresolved}, 优化得分=${stats.optimization.planScore.toFixed(2)}`);
    }

    // 停止演示
    stopDemo() {
        console.log('停止代理协调系统演示...');

        this.isRunning = false;

        if (this.demoInterval) {
            clearInterval(this.demoInterval);
            this.demoInterval = null;
        }

        if (this.uiInterval) {
            clearInterval(this.uiInterval);
            this.uiInterval = null;
        }
    }

    // 生成报告
    generateReport() {
        console.log('=== 代理协调系统演示报告 ===');

        if (this.diziApp.agentIntegration) {
            const stats = this.diziApp.agentIntegration.getSystemStats();

            const report = {
                timestamp: new Date().toISOString(),
                system: {
                    totalAgents: stats.agents.total,
                    activeAgents: stats.agents.active,
                    totalConflicts: stats.results.totalConflicts,
                    resolvedConflicts: stats.results.resolvedConflicts
                },
                optimization: {
                    hasPlan: stats.optimization.hasPlan,
                    planScore: stats.optimization.planScore,
                    estimatedImprovement: stats.optimization.planScore * 100,
                    lastOptimization: stats.optimization.lastOptimization
                },
                priorities: stats.priorities,
                agents: {}
            };

            // 收集每个代理的详细信息
            ['animation', 'gpu', 'memory', 'mobile'].forEach(agentId => {
                report.agents[agentId] = this.diziApp.agentIntegration.getAgentStatus(agentId);
            });

            console.log('演示报告:', report);
            return report;
        }

        return null;
    }

    // 导出演示日志
    exportDemoLogs() {
        const logs = this.getDemoLogs();
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `agent_coordination_demo_${Date.now()}.json`;
        link.click();

        URL.revokeObjectURL(url);
    }

    // 获取演示日志
    getDemoLogs() {
        return {
            startTime: this.startTime,
            endTime: new Date().toISOString(),
            steps: this.executedSteps || [],
            report: this.generateReport()
        };
    }
}

// 启动演示
window.addEventListener('DOMContentLoaded', () => {
    const demo = new AgentCoordinationDemo();
    demo.init();

    // 暴露演示对象到全局作用域
    window.AgentCoordinationDemo = demo;

    // 添加控制台命令
    window.demo = {
        start: () => demo.startDemo(),
        stop: () => demo.stopDemo(),
        status: () => demo.generateReport(),
        logs: () => demo.exportDemoLogs(),
        reset: () => {
            demo.stopDemo();
            demo.init();
        }
    };

    console.log('代理协调系统演示已启动');
    console.log('可用的控制台命令:');
    console.log('- demo.start() - 启动演示');
    console.log('- demo.stop() - 停止演示');
    console.log('- demo.status() - 获取状态报告');
    console.log('- demo.logs() - 导出日志');
    console.log('- demo.reset() - 重置演示');
});