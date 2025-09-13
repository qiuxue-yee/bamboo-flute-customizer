// 多代理协调系统
class AgentCoordinator {
    constructor() {
        // 注册的代理列表
        this.agents = new Map();
        this.agentResults = new Map();
        this.conflicts = [];
        this.optimizationPlan = null;
        this.priorityScores = new Map();

        // 系统配置
        this.config = {
            enableConflictResolution: true,
            enableAutoOptimization: false,
            optimizationInterval: 5000,
            maxConflicts: 10,
            priorityThreshold: 0.7,
            consistencyCheckInterval: 30000
        };

        // 系统状态
        this.state = {
            isRunning: false,
            lastOptimization: 0,
            totalConflicts: 0,
            resolvedConflicts: 0,
            optimizationScore: 0
        };

        // 初始化协调系统
        this.init();
    }

    // 初始化协调系统
    init() {
        console.log('初始化代理协调系统...');

        // 初始化结果收集器
        this.resultCollector = new ResultCollector();

        // 初始化冲突检测器
        this.conflictDetector = new ConflictDetector();

        // 初始化优化计划生成器
        this.planGenerator = new OptimizationPlanGenerator();

        // 初始化优先级排序器
        this.prioritySorter = new PrioritySorter();

        // 初始化一致性检查器
        this.consistencyChecker = new ConsistencyChecker();

        // 设置定期检查
        this.startPeriodicChecks();

        console.log('代理协调系统初始化完成');
    }

    // 注册代理
    registerAgent(agentId, agent, capabilities = []) {
        this.agents.set(agentId, {
            agent: agent,
            capabilities: capabilities,
            lastOptimization: 0,
            performanceScore: 0,
            isActive: true
        });

        console.log(`代理已注册: ${agentId} (${capabilities.join(', ')})`);
        return agentId;
    }

    // 取消注册代理
    unregisterAgent(agentId) {
        if (this.agents.has(agentId)) {
            this.agents.delete(agentId);
            this.agentResults.delete(agentId);
            console.log(`代理已注销: ${agentId}`);
        }
    }

    // 启动所有代理
    startAllAgents() {
        this.state.isRunning = true;

        this.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.isActive) {
                this.startAgent(agentId);
            }
        });

        console.log('所有代理已启动');
    }

    // 启动单个代理
    startAgent(agentId) {
        const agentInfo = this.agents.get(agentId);
        if (agentInfo) {
            agentInfo.lastOptimization = Date.now();

            // 根据代理类型调用相应的方法
            if (agentInfo.agent.startOptimization) {
                agentInfo.agent.startOptimization();
            }

            console.log(`代理已启动: ${agentId}`);
        }
    }

    // 停止所有代理
    stopAllAgents() {
        this.state.isRunning = false;

        this.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.isActive) {
                this.stopAgent(agentId);
            }
        });

        console.log('所有代理已停止');
    }

    // 停止单个代理
    stopAgent(agentId) {
        const agentInfo = this.agents.get(agentId);
        if (agentInfo) {
            // 根据代理类型调用相应的方法
            if (agentInfo.agent.stopOptimization) {
                agentInfo.agent.stopOptimization();
            }

            console.log(`代理已停止: ${agentId}`);
        }
    }

    // 收集所有代理的审查结果
    collectAgentResults() {
        console.log('开始收集代理审查结果...');

        const results = new Map();

        this.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.isActive && agentInfo.agent.getOptimizationResults) {
                try {
                    const result = agentInfo.agent.getOptimizationResults();
                    results.set(agentId, result);
                    console.log(`收集到代理结果: ${agentId}`);
                } catch (error) {
                    console.error(`收集代理结果失败 ${agentId}:`, error);
                }
            }
        });

        this.agentResults = results;
        return results;
    }

    // 识别冲突和建议
    identifyConflicts() {
        if (this.agentResults.size < 2) {
            console.log('没有足够的代理结果进行冲突检测');
            return [];
        }

        console.log('开始识别代理冲突...');

        const conflicts = [];
        const results = Array.from(this.agentResults.entries());

        // 检测不同代理之间的冲突
        for (let i = 0; i < results.length; i++) {
            for (let j = i + 1; j < results.length; j++) {
                const [agentId1, result1] = results[i];
                const [agentId2, result2] = results[j];

                const conflictsPair = this.conflictDetector.detect(
                    agentId1, result1,
                    agentId2, result2
                );

                conflicts.push(...conflictsPair);
            }
        }

        this.conflicts = conflicts;
        this.state.totalConflicts = this.conflicts.length;

        console.log(`检测到 ${conflicts.length} 个冲突`);
        return conflicts;
    }

    // 生成统一的优化方案
    generateUnifiedPlan() {
        if (this.agentResults.size === 0) {
            console.log('没有代理结果，无法生成优化方案');
            return null;
        }

        console.log('生成统一优化方案...');

        // 首先解决冲突
        if (this.config.enableConflictResolution) {
            this.resolveConflicts();
        }

        // 生成优化计划
        const plan = this.planGenerator.generate(
            this.agentResults,
            this.priorityScores
        );

        this.optimizationPlan = plan;

        console.log('统一优化方案生成完成');
        return plan;
    }

    // 解决冲突
    resolveConflicts() {
        console.log('开始解决代理冲突...');

        for (const conflict of this.conflicts) {
            if (this.priorityScores.has(conflict.agent1) &&
                this.priorityScores.has(conflict.agent2)) {

                const score1 = this.priorityScores.get(conflict.agent1);
                const score2 = this.priorityScores.get(conflict.agent2);

                if (score1 > score2) {
                    // 优先级更高的代理获胜
                    conflict.resolution = `优先使用 ${conflict.agent1} 的建议`;
                } else if (score2 > score1) {
                    conflict.resolution = `优先使用 ${conflict.agent2} 的建议`;
                } else {
                    // 相同优先级，综合处理
                    conflict.resolution = '综合处理两个代理的建议';
                }

                this.state.resolvedConflicts++;
            }
        }

        console.log(`已解决 ${this.state.resolvedConflicts} 个冲突`);
    }

    // 建立优先级排序
    establishPriority(agentId, criteria) {
        if (!this.agents.has(agentId)) {
            console.warn(`代理不存在: ${agentId}`);
            return;
        }

        const score = this.prioritySorter.calculateScore(agentId, criteria);
        this.priorityScores.set(agentId, score);

        console.log(`代理优先级已设置: ${agentId} = ${score}`);
    }

    // 执行优化方案
    executeOptimizationPlan() {
        if (!this.optimizationPlan) {
            console.log('没有可执行的优化方案');
            return false;
        }

        console.log('开始执行优化方案...');

        try {
            let successCount = 0;

            for (const action of this.optimizationPlan.actions) {
                if (this.executeAction(action)) {
                    successCount++;
                }
            }

            const successRate = successCount / this.optimizationPlan.actions.length;
            this.state.optimizationScore = successRate;

            console.log(`优化方案执行完成: ${successRate.toFixed(2)} 成功率`);
            return true;

        } catch (error) {
            console.error('执行优化方案失败:', error);
            return false;
        }
    }

    // 执行单个优化动作
    executeAction(action) {
        try {
            switch (action.type) {
                case 'configuration_update':
                    this.updateConfiguration(action.agentId, action.config);
                    break;
                case 'parameter_adjustment':
                    this.adjustParameters(action.agentId, action.params);
                    break;
                case 'resource_optimization':
                    this.optimizeResources(action.agentId, action.resources);
                    break;
                case 'performance_monitoring':
                    this.startPerformanceMonitoring(action.agentId);
                    break;
                default:
                    console.warn(`未知的优化动作类型: ${action.type}`);
                    return false;
            }

            return true;
        } catch (error) {
            console.error(`执行优化动作失败: ${action.type}`, error);
            return false;
        }
    }

    // 更新配置
    updateConfiguration(agentId, config) {
        const agentInfo = this.agents.get(agentId);
        if (agentInfo && agentInfo.agent.updateConfiguration) {
            agentInfo.agent.updateConfiguration(config);
        }
    }

    // 调整参数
    adjustParameters(agentId, params) {
        const agentInfo = this.agents.get(agentId);
        if (agentInfo && agentInfo.agent.adjustParameters) {
            agentInfo.agent.adjustParameters(params);
        }
    }

    // 优化资源
    optimizeResources(agentId, resources) {
        const agentInfo = this.agents.get(agentId);
        if (agentInfo && agentInfo.agent.optimizeResources) {
            agentInfo.agent.optimizeResources(resources);
        }
    }

    // 开始性能监控
    startPerformanceMonitoring(agentId) {
        const agentInfo = this.agents.get(agentId);
        if (agentInfo && agentInfo.agent.startPerformanceMonitoring) {
            agentInfo.agent.startPerformanceMonitoring();
        }
    }

    // 确保一致性
    ensureConsistency() {
        console.log('开始一致性检查...');

        const issues = this.consistencyChecker.checkAll(
            this.agents,
            this.agentResults,
            this.optimizationPlan
        );

        if (issues.length > 0) {
            console.log(`发现 ${issues.length} 个一致性问题`);
            return this.resolveConsistencyIssues(issues);
        } else {
            console.log('系统状态一致');
            return true;
        }
    }

    // 解决一致性问题
    resolveConsistencyIssues(issues) {
        console.log('开始解决一致性问题...');

        let resolvedCount = 0;

        for (const issue of issues) {
            try {
                switch (issue.type) {
                    case 'configuration_mismatch':
                        this.resolveConfigurationMismatch(issue);
                        break;
                    case 'parameter_conflict':
                        this.resolveParameterConflict(issue);
                        break;
                    case 'resource_conflict':
                        this.resolveResourceConflict(issue);
                        break;
                    case 'state_inconsistency':
                        this.resolveStateInconsistency(issue);
                        break;
                }

                resolvedCount++;
            } catch (error) {
                console.error(`解决一致性问题失败:`, error);
            }
        }

        console.log(`已解决 ${resolvedCount}/${issues.length} 个一致性问题`);
        return resolvedCount === issues.length;
    }

    // 配置不匹配解决
    resolveConfigurationMismatch(issue) {
        const agent1 = this.agents.get(issue.agent1);
        const agent2 = this.agents.get(issue.agent2);

        if (agent1 && agent2) {
            // 使用优先级更高的配置
            const score1 = this.priorityScores.get(issue.agent1) || 0;
            const score2 = this.priorityScores.get(issue.agent2) || 0;

            if (score1 > score2) {
                agent2.agent.updateConfiguration(issue.config1);
            } else {
                agent1.agent.updateConfiguration(issue.config2);
            }
        }
    }

    // 参数冲突解决
    resolveParameterConflict(issue) {
        // 使用平均值或中间值
        const avgValue = (issue.value1 + issue.value2) / 2;

        this.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.agent.adjustParameters) {
                agentInfo.agent.adjustParameters({
                    [issue.parameter]: avgValue
                });
            }
        });
    }

    // 资源冲突解决
    resolveResourceConflict(issue) {
        // 平衡分配资源
        const total = issue.resource1 + issue.resource2;
        const half = total / 2;

        this.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.agent.optimizeResources) {
                agentInfo.agent.optimizeResources({
                    [issue.resourceType]: half
                });
            }
        });
    }

    // 状态不一致解决
    resolveStateInconsistency(issue) {
        // 重置所有代理状态
        this.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.agent.resetState) {
                agentInfo.agent.resetState();
            }
        });
    }

    // 获取系统统计信息
    getSystemStats() {
        const activeAgents = Array.from(this.agents.values()).filter(a => a.isActive).length;
        const totalResults = this.agentResults.size;

        return {
            state: this.state,
            agents: {
                total: this.agents.size,
                active: activeAgents,
                registered: Array.from(this.agents.keys())
            },
            results: {
                collected: totalResults,
                totalConflicts: this.state.totalConflicts,
                resolvedConflicts: this.state.resolvedConflicts
            },
            conflicts: {
                detected: this.conflicts.length,
                unresolved: this.conflicts.filter(c => !c.resolution).length
            },
            optimization: {
                hasPlan: !!this.optimizationPlan,
                planScore: this.state.optimizationScore,
                lastOptimization: this.state.lastOptimization
            },
            priorities: Array.from(this.priorityScores.entries())
        };
    }

    // 获取代理详细状态
    getAgentStatus(agentId) {
        const agentInfo = this.agents.get(agentId);
        if (!agentInfo) {
            return null;
        }

        return {
            id: agentId,
            isActive: agentInfo.isActive,
            capabilities: agentInfo.capabilities,
            lastOptimization: agentInfo.lastOptimization,
            performanceScore: agentInfo.performanceScore,
            priority: this.priorityScores.get(agentId) || 0
        };
    }

    // 启动定期检查
    startPeriodicChecks() {
        setInterval(() => {
            if (this.state.isRunning) {
                this.checkSystemHealth();
                this.consistencyCheck();
            }
        }, this.config.consistencyCheckInterval);
    }

    // 检查系统健康状态
    checkSystemHealth() {
        const stats = this.getSystemStats();

        // 检查是否有代理需要重启
        this.agents.forEach((agentInfo, agentId) => {
            if (agentInfo.isActive) {
                const timeSinceOpt = Date.now() - agentInfo.lastOptimization;
                if (timeSinceOpt > this.config.optimizationInterval * 3) {
                    console.warn(`代理 ${agentId} 可能需要重启`);
                }
            }
        });
    }

    // 一致性检查
    consistencyCheck() {
        const issues = this.consistencyChecker.checkAll(
            this.agents,
            this.agentResults,
            this.optimizationPlan
        );

        if (issues.length > 0) {
            console.warn(`发现 ${issues.length} 个一致性问题`);
        }
    }

    // 销毁协调系统
    destroy() {
        this.stopAllAgents();
        this.agents.clear();
        this.agentResults.clear();
        this.conflicts = [];
        this.optimizationPlan = null;
        this.priorityScores.clear();

        console.log('代理协调系统已销毁');
    }
}

// 结果收集器
class ResultCollector {
    constructor() {
        this.results = new Map();
    }

    collect(agentId, result) {
        this.results.set(agentId, result);
    }

    getResults() {
        return this.results;
    }

    clear() {
        this.results.clear();
    }
}

// 冲突检测器
class ConflictDetector {
    detect(agentId1, result1, agentId2, result2) {
        const conflicts = [];

        // 检测配置冲突
        const configConflicts = this.detectConfigConflicts(agentId1, result1, agentId2, result2);
        conflicts.push(...configConflicts);

        // 检测参数冲突
        const paramConflicts = this.detectParameterConflicts(agentId1, result1, agentId2, result2);
        conflicts.push(...paramConflicts);

        // 检测资源冲突
        const resourceConflicts = this.detectResourceConflicts(agentId1, result1, agentId2, result2);
        conflicts.push(...resourceConflicts);

        return conflicts;
    }

    detectConfigConflicts(agentId1, result1, agentId2, result2) {
        const conflicts = [];

        if (result1.config && result2.config) {
            for (const [key, value1] of Object.entries(result1.config)) {
                if (result2.config[key] !== undefined && result2.config[key] !== value1) {
                    conflicts.push({
                        type: 'configuration_conflict',
                        agent1: agentId1,
                        agent2: agentId2,
                        parameter: key,
                        value1: value1,
                        value2: result2.config[key],
                        severity: this.calculateConflictSeverity(value1, result2.config[key])
                    });
                }
            }
        }

        return conflicts;
    }

    detectParameterConflicts(agentId1, result1, agentId2, result2) {
        const conflicts = [];

        if (result1.parameters && result2.parameters) {
            for (const [key, value1] of Object.entries(result1.parameters)) {
                if (result2.parameters[key] !== undefined && result2.parameters[key] !== value1) {
                    conflicts.push({
                        type: 'parameter_conflict',
                        agent1: agentId1,
                        agent2: agentId2,
                        parameter: key,
                        value1: value1,
                        value2: result2.parameters[key],
                        severity: this.calculateConflictSeverity(value1, result2.parameters[key])
                    });
                }
            }
        }

        return conflicts;
    }

    detectResourceConflicts(agentId1, result1, agentId2, result2) {
        const conflicts = [];

        if (result1.resources && result2.resources) {
            for (const [key, value1] of Object.entries(result1.resources)) {
                if (result2.resources[key] !== undefined && result2.resources[key] !== value1) {
                    conflicts.push({
                        type: 'resource_conflict',
                        agent1: agentId1,
                        agent2: agentId2,
                        resourceType: key,
                        value1: value1,
                        value2: result2.resources[key],
                        severity: this.calculateConflictSeverity(value1, result2.resources[key])
                    });
                }
            }
        }

        return conflicts;
    }

    calculateConflictSeverity(value1, value2) {
        const diff = Math.abs(value1 - value2);
        const ratio = diff / Math.max(Math.abs(value1), Math.abs(value2));

        if (ratio > 0.5) return 'high';
        if (ratio > 0.2) return 'medium';
        return 'low';
    }
}

// 优化计划生成器
class OptimizationPlanGenerator {
    generate(results, priorityScores) {
        const actions = [];

        // 根据结果生成优化动作
        results.forEach((result, agentId) => {
            if (result.config) {
                actions.push({
                    type: 'configuration_update',
                    agentId: agentId,
                    config: result.config,
                    priority: priorityScores.get(agentId) || 0.5
                });
            }

            if (result.parameters) {
                actions.push({
                    type: 'parameter_adjustment',
                    agentId: agentId,
                    params: result.parameters,
                    priority: priorityScores.get(agentId) || 0.5
                });
            }

            if (result.resources) {
                actions.push({
                    type: 'resource_optimization',
                    agentId: agentId,
                    resources: result.resources,
                    priority: priorityScores.get(agentId) || 0.5
                });
            }
        });

        // 添加性能监控动作
        actions.push({
            type: 'performance_monitoring',
            agentId: 'all',
            priority: 1.0
        });

        // 按优先级排序
        actions.sort((a, b) => b.priority - a.priority);

        return {
            actions: actions,
            totalActions: actions.length,
            estimatedImprovement: this.estimateImprovement(actions)
        };
    }

    estimateImprovement(actions) {
        // 简单的改进估算逻辑
        const baseScore = 0.5;
        const improvementPerAction = 0.05;

        return Math.min(baseScore + (actions.length * improvementPerAction), 1.0);
    }
}

// 优先级排序器
class PrioritySorter {
    calculateScore(agentId, criteria) {
        let score = 0;

        // 基础分
        score += 0.3;

        // 根据标准加分
        if (criteria.performance) {
            score += 0.2;
        }

        if (criteria.reliability) {
            score += 0.2;
        }

        if (criteria.resourceUsage) {
            score += 0.15;
        }

        if (criteria.compatibility) {
            score += 0.15;
        }

        return Math.min(score, 1.0);
    }
}

// 一致性检查器
class ConsistencyChecker {
    checkAll(agents, results, plan) {
        const issues = [];

        // 检查配置一致性
        const configIssues = this.checkConfigurationConsistency(agents, results);
        issues.push(...configIssues);

        // 检查参数一致性
        const paramIssues = this.checkParameterConsistency(agents, results);
        issues.push(...paramIssues);

        // 检查资源一致性
        const resourceIssues = this.checkResourceConsistency(agents, results);
        issues.push(...resourceIssues);

        // 检查计划一致性
        if (plan) {
            const planIssues = this.checkPlanConsistency(plan, results);
            issues.push(...planIssues);
        }

        return issues;
    }

    checkConfigurationConsistency(agents, results) {
        const issues = [];
        const configs = [];

        results.forEach((result, agentId) => {
            if (result.config) {
                configs.push({ agentId, config: result.config });
            }
        });

        if (configs.length > 1) {
            // 检查配置冲突
            for (let i = 0; i < configs.length; i++) {
                for (let j = i + 1; j < configs.length; j++) {
                    const conflicts = this.detectConfigConflicts(configs[i], configs[j]);
                    issues.push(...conflicts);
                }
            }
        }

        return issues;
    }

    checkParameterConsistency(agents, results) {
        const issues = [];
        const params = [];

        results.forEach((result, agentId) => {
            if (result.parameters) {
                params.push({ agentId, params: result.parameters });
            }
        });

        if (params.length > 1) {
            // 检查参数冲突
            for (let i = 0; i < params.length; i++) {
                for (let j = i + 1; j < params.length; j++) {
                    const conflicts = this.detectParameterConflicts(params[i], params[j]);
                    issues.push(...conflicts);
                }
            }
        }

        return issues;
    }

    checkResourceConsistency(agents, results) {
        const issues = [];
        const resources = [];

        results.forEach((result, agentId) => {
            if (result.resources) {
                resources.push({ agentId, resources: result.resources });
            }
        });

        if (resources.length > 1) {
            // 检查资源冲突
            for (let i = 0; i < resources.length; i++) {
                for (let j = i + 1; j < resources.length; j++) {
                    const conflicts = this.detectResourceConflicts(resources[i], resources[j]);
                    issues.push(...conflicts);
                }
            }
        }

        return issues;
    }

    checkPlanConsistency(plan, results) {
        const issues = [];

        plan.actions.forEach(action => {
            if (action.type === 'configuration_update') {
                const result = results.get(action.agentId);
                if (result && result.config) {
                    // 检查计划配置与结果配置是否一致
                    for (const [key, value] of Object.entries(action.config)) {
                        if (result.config[key] !== value) {
                            issues.push({
                                type: 'plan_config_mismatch',
                                action: action,
                                agentId: action.agentId,
                                parameter: key,
                                planValue: value,
                                resultValue: result.config[key]
                            });
                        }
                    }
                }
            }
        });

        return issues;
    }

    detectConfigConflicts(config1, config2) {
        const conflicts = [];

        for (const [key, value1] of Object.entries(config1.config)) {
            if (config2.config[key] !== undefined && config2.config[key] !== value1) {
                conflicts.push({
                    type: 'configuration_mismatch',
                    agent1: config1.agentId,
                    agent2: config2.agentId,
                    config1: { [key]: value1 },
                    config2: { [key]: config2.config[key] }
                });
            }
        }

        return conflicts;
    }

    detectParameterConflicts(params1, params2) {
        const conflicts = [];

        for (const [key, value1] of Object.entries(params1.params)) {
            if (params2.params[key] !== undefined && params2.params[key] !== value1) {
                conflicts.push({
                    type: 'parameter_conflict',
                    agent1: params1.agentId,
                    agent2: params2.agentId,
                    parameter: key,
                    value1: value1,
                    value2: params2.params[key]
                });
            }
        }

        return conflicts;
    }

    detectResourceConflicts(resources1, resources2) {
        const conflicts = [];

        for (const [key, value1] of Object.entries(resources1.resources)) {
            if (resources2.resources[key] !== undefined && resources2.resources[key] !== value1) {
                conflicts.push({
                    type: 'resource_conflict',
                    agent1: resources1.agentId,
                    agent2: resources2.agentId,
                    resourceType: key,
                    resource1: value1,
                    resource2: resources2.resources[key]
                });
            }
        }

        return conflicts;
    }
}

// 导出代理协调系统
window.AgentCoordinator = AgentCoordinator;