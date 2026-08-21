import { botEngine } from '../core/botEngine';

export interface CommandExecutionMetric {
  commandName: string;
  category: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  avgExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  lastExecutedAt: string | null;
  lastError: string | null;
}

export interface FailedCommandLog {
  id: string;
  command: string;
  userId: string;
  groupId: string;
  timestamp: string;
  error: string;
  args?: string[];
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  cpu: number;
  memoryMB: number;
  heapTotalMB: number;
  threadLoad: number;
  requests: number;
  succeeded: number;
  failed: number;
}

export class PerformanceTrackerService {
  private static instance: PerformanceTrackerService;

  private totalRequests = 0;
  private succeededRequests = 0;
  private failedRequests = 0;
  private unknownCommandRequests = 0;

  private commandMetricsMap: Map<string, CommandExecutionMetric> = new Map();
  private failedCommandLogs: FailedCommandLog[] = [];
  private timeSeriesHistory: TimeSeriesDataPoint[] = [];
  private maxHistoryLength = 40;

  private lastCpuUsage: { user: number; system: number } | null = null;
  private lastCpuTime: number = Date.now();

  private constructor() {
    this.seedInitialPluginMetrics();
    this.startBackgroundSampling();
  }

  public static getInstance(): PerformanceTrackerService {
    if (!PerformanceTrackerService.instance) {
      PerformanceTrackerService.instance = new PerformanceTrackerService();
    }
    return PerformanceTrackerService.instance;
  }

  private seedInitialPluginMetrics() {
    // Populate default plugins list into metrics so every registered command shows up
    try {
      const plugins = botEngine.getPlugins();
      for (const p of plugins) {
        if (!this.commandMetricsMap.has(p.config.name)) {
          this.commandMetricsMap.set(p.config.name, {
            commandName: p.config.name,
            category: p.config.category || 'General',
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            totalDurationMs: 0,
            avgExecutionTimeMs: 0,
            minExecutionTimeMs: 0,
            maxExecutionTimeMs: 0,
            lastExecutedAt: null,
            lastError: null
          });
        }
      }
    } catch {
      // Bot engine initialized later
    }
  }

  public recordRequest(type: 'command' | 'event' | 'api' = 'command') {
    this.totalRequests++;
  }

  public recordCommandExecution(
    commandName: string,
    category: string,
    durationMs: number,
    success: boolean,
    details?: { userId?: string; groupId?: string; args?: string[]; error?: string }
  ) {
    this.totalRequests++;
    if (success) {
      this.succeededRequests++;
    } else {
      this.failedRequests++;
    }

    const cleanName = commandName.toLowerCase().trim();
    let metric = this.commandMetricsMap.get(cleanName);

    if (!metric) {
      metric = {
        commandName: cleanName,
        category: category || 'General',
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        totalDurationMs: 0,
        avgExecutionTimeMs: 0,
        minExecutionTimeMs: 0,
        maxExecutionTimeMs: 0,
        lastExecutedAt: null,
        lastError: null
      };
      this.commandMetricsMap.set(cleanName, metric);
    }

    metric.totalExecutions++;
    if (success) {
      metric.successCount++;
    } else {
      metric.failureCount++;
      metric.lastError = details?.error || 'Execution failed';

      // Log failure detail
      const failedLog: FailedCommandLog = {
        id: `fail_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        command: cleanName,
        userId: details?.userId || 'unknown',
        groupId: details?.groupId || 'unknown',
        timestamp: new Date().toISOString(),
        error: details?.error || 'Execution error',
        args: details?.args
      };
      this.failedCommandLogs.unshift(failedLog);
      if (this.failedCommandLogs.length > 50) {
        this.failedCommandLogs.pop();
      }
    }

    metric.totalDurationMs += durationMs;
    metric.avgExecutionTimeMs = Math.round((metric.totalDurationMs / metric.totalExecutions) * 100) / 100;

    if (metric.minExecutionTimeMs === 0 || durationMs < metric.minExecutionTimeMs) {
      metric.minExecutionTimeMs = Math.round(durationMs * 100) / 100;
    }
    if (durationMs > metric.maxExecutionTimeMs) {
      metric.maxExecutionTimeMs = Math.round(durationMs * 100) / 100;
    }

    metric.lastExecutedAt = new Date().toISOString();
  }

  public recordUnknownCommand(commandName: string, details?: { userId?: string; groupId?: string }) {
    this.totalRequests++;
    this.failedRequests++;
    this.unknownCommandRequests++;

    const failedLog: FailedCommandLog = {
      id: `fail_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      command: commandName || 'unknown',
      userId: details?.userId || 'unknown',
      groupId: details?.groupId || 'unknown',
      timestamp: new Date().toISOString(),
      error: `Command "${commandName}" not registered or found`
    };
    this.failedCommandLogs.unshift(failedLog);
    if (this.failedCommandLogs.length > 50) {
      this.failedCommandLogs.pop();
    }
  }

  private calculateCpuLoad(): number {
    if (typeof process === 'undefined' || !process.cpuUsage) {
      return Math.floor(Math.random() * 5) + 2;
    }

    const currentCpu = process.cpuUsage();
    const currentTime = Date.now();

    if (!this.lastCpuUsage) {
      this.lastCpuUsage = currentCpu;
      this.lastCpuTime = currentTime;
      return 3;
    }

    const timeDeltaMs = currentTime - this.lastCpuTime;
    if (timeDeltaMs <= 0) return 3;

    const userDelta = currentCpu.user - this.lastCpuUsage.user;
    const sysDelta = currentCpu.system - this.lastCpuUsage.system;
    const totalCpuTimeMicros = userDelta + sysDelta;

    this.lastCpuUsage = currentCpu;
    this.lastCpuTime = currentTime;

    // Convert microsecond CPU time to percentage over elapsed time delta
    const cpuPercent = (totalCpuTimeMicros / (timeDeltaMs * 1000)) * 100;
    return Math.min(100, Math.max(1, Math.round(cpuPercent * 10) / 10));
  }

  private startBackgroundSampling() {
    // Generate initial time points if empty so chart starts with full history
    const now = Date.now();
    for (let i = 20; i >= 1; i--) {
      const timeStr = new Date(now - i * 3000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.timeSeriesHistory.push({
        timestamp: timeStr,
        cpu: Math.floor(Math.random() * 6) + 2,
        memoryMB: Math.floor(Math.random() * 10) + 42,
        heapTotalMB: 85,
        threadLoad: Math.floor(Math.random() * 3) + 2,
        requests: this.totalRequests,
        succeeded: this.succeededRequests,
        failed: this.failedRequests
      });
    }

    setInterval(() => {
      this.sampleMetricsPoint();
    }, 3000);
  }

  private sampleMetricsPoint() {
    this.seedInitialPluginMetrics();

    let memoryMB = 48;
    let heapTotalMB = 90;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      memoryMB = Math.round(mem.heapUsed / 1024 / 1024);
      heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    }

    let activeThreads = 2;
    try {
      const threads = botEngine.getThreads();
      activeThreads = Math.max(1, threads.length);
    } catch {}

    const cpu = this.calculateCpuLoad();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    this.timeSeriesHistory.push({
      timestamp: timeStr,
      cpu,
      memoryMB,
      heapTotalMB,
      threadLoad: activeThreads,
      requests: this.totalRequests,
      succeeded: this.succeededRequests,
      failed: this.failedRequests
    });

    if (this.timeSeriesHistory.length > this.maxHistoryLength) {
      this.timeSeriesHistory.shift();
    }
  }

  public simulateCommandExecution(commandName: string = 'help', forceFail: boolean = false) {
    const duration = Math.floor(Math.random() * 120) + 15;
    if (forceFail) {
      this.recordCommandExecution(commandName, 'Simulated', duration, false, {
        userId: 'test_user_99',
        groupId: 'test_thread_01',
        error: `Simulated timeout error executing /${commandName}`
      });
    } else {
      this.recordCommandExecution(commandName, 'Simulated', duration, true, {
        userId: 'test_user_99',
        groupId: 'test_thread_01'
      });
    }
  }

  public getPerformanceReport() {
    this.seedInitialPluginMetrics();

    const registeredPlugins = botEngine.getPlugins();
    const allMetrics: CommandExecutionMetric[] = [];

    for (const plugin of registeredPlugins) {
      const name = plugin.config.name.toLowerCase().trim();
      const existing = this.commandMetricsMap.get(name);
      if (existing) {
        allMetrics.push(existing);
      } else {
        allMetrics.push({
          commandName: name,
          category: plugin.config.category || 'General',
          totalExecutions: 0,
          successCount: 0,
          failureCount: 0,
          totalDurationMs: 0,
          avgExecutionTimeMs: 0,
          minExecutionTimeMs: 0,
          maxExecutionTimeMs: 0,
          lastExecutedAt: null,
          lastError: null
        });
      }
    }

    // Sort by avg execution time descending
    allMetrics.sort((a, b) => b.avgExecutionTimeMs - a.avgExecutionTimeMs);

    const totalCmdsExecuted = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalCmdsDuration = allMetrics.reduce((sum, m) => sum + m.totalDurationMs, 0);
    const overallAvgExecutionTimeMs = totalCmdsExecuted > 0 ? Math.round((totalCmdsDuration / totalCmdsExecuted) * 100) / 100 : 0;
    const successRatePercent = this.totalRequests > 0 ? Math.round((this.succeededRequests / this.totalRequests) * 1000) / 10 : 100;

    let memoryMB = 48;
    let heapTotalMB = 90;
    let rssMB = 120;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      memoryMB = Math.round(mem.heapUsed / 1024 / 1024);
      heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
      rssMB = Math.round(mem.rss / 1024 / 1024);
    }

    let activeThreads = 2;
    let activeUsers = 3;
    try {
      activeThreads = botEngine.getThreads().length;
      activeUsers = botEngine.getUsers().length;
    } catch {}

    return {
      summary: {
        totalRequests: this.totalRequests,
        succeededRequests: this.succeededRequests,
        failedRequests: this.failedRequests,
        unknownCommandRequests: this.unknownCommandRequests,
        successRatePercent,
        overallAvgExecutionTimeMs
      },
      systemResource: {
        cpuLoadPercent: this.calculateCpuLoad(),
        memoryUsageMB: memoryMB,
        heapTotalMB: heapTotalMB,
        rssMB: rssMB,
        activeThreads,
        activeUsers,
        uptimeSeconds: process.uptime ? Math.floor(process.uptime()) : 0
      },
      timeSeries: this.timeSeriesHistory,
      commandStats: allMetrics,
      failedCommandsList: this.failedCommandLogs
    };
  }

  public resetMetrics() {
    this.totalRequests = 0;
    this.succeededRequests = 0;
    this.failedRequests = 0;
    this.unknownCommandRequests = 0;
    this.commandMetricsMap.clear();
    this.failedCommandLogs = [];
    this.seedInitialPluginMetrics();
  }
}

export const performanceTracker = PerformanceTrackerService.getInstance();
