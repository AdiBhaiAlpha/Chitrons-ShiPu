import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Cpu,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  Layers,
  BarChart3,
  RefreshCw,
  Play,
  RotateCcw,
  Bug,
  Server
} from 'lucide-react';

export interface TimeSeriesPoint {
  timestamp: string;
  cpu: number;
  memoryMB: number;
  heapTotalMB: number;
  threadLoad: number;
  requests: number;
  succeeded: number;
  failed: number;
}

export interface CommandStatItem {
  commandName: string;
  category: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  lastExecutedAt: string | null;
  lastError: string | null;
}

export interface PerformanceReport {
  summary: {
    totalRequests: number;
    succeededRequests: number;
    failedRequests: number;
    unknownCommandRequests: number;
    successRatePercent: number;
    overallAvgExecutionTimeMs: number;
  };
  systemResource: {
    cpuLoadPercent: number;
    memoryUsageMB: number;
    heapTotalMB: number;
    rssMB: number;
    activeThreads: number;
    activeUsers: number;
    uptimeSeconds: number;
  };
  timeSeries: TimeSeriesPoint[];
  commandStats: CommandStatItem[];
  failedCommandsList: Array<{
    id: string;
    command: string;
    userId: string;
    groupId: string;
    timestamp: string;
    error: string;
    args?: string[];
  }>;
}

interface D3SystemObservabilityProps {
  report: PerformanceReport | null;
  onRefresh: () => void;
  onSimulate: (command: string, forceFail: boolean) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export const D3SystemObservability: React.FC<D3SystemObservabilityProps> = ({
  report,
  onRefresh,
  onSimulate,
  onReset,
  isLoading = false
}) => {
  const resourceChartRef = useRef<SVGSVGElement | null>(null);
  const requestChartRef = useRef<SVGSVGElement | null>(null);
  const commandLatencyChartRef = useRef<SVGSVGElement | null>(null);

  const [testCmdInput, setTestCmdInput] = useState<string>('help');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'charts' | 'commands' | 'failures'>('charts');

  // 1. Render D3 System Resource (CPU, Memory, Thread Load) Real-Time Line/Area Chart
  useEffect(() => {
    if (!report || !report.timeSeries || report.timeSeries.length === 0 || !resourceChartRef.current) {
      return;
    }

    const svgElement = resourceChartRef.current;
    d3.select(svgElement).selectAll('*').remove();

    const width = svgElement.clientWidth || 700;
    const height = 240;
    const margin = { top: 20, right: 30, bottom: 30, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data: TimeSeriesPoint[] = report.timeSeries;

    // Scales
    const xScale = d3
      .scalePoint<string>()
      .domain(data.map((d: TimeSeriesPoint) => d.timestamp))
      .range([0, innerWidth]);

    const maxMem = d3.max(data, (d: TimeSeriesPoint) => d.heapTotalMB) || 100;
    const yScale = d3.scaleLinear().domain([0, Math.max(100, maxMem + 10)]).range([innerHeight, 0]);

    // Gridlines
    const yGrid = d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => '');
    svg.append('g').attr('class', 'grid').call(yGrid).selectAll('line').attr('stroke', '#1e293b').attr('stroke-dasharray', '3,3');

    // Axes
    const xAxis = d3.axisBottom(xScale).tickValues(xScale.domain().filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0));
    const yAxis = d3.axisLeft(yScale).ticks(5);

    svg
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('font-size', '10px');

    svg.append('g').call(yAxis).attr('color', '#64748b').selectAll('text').attr('font-size', '10px');

    // Area for Memory
    const memoryArea = d3
      .area<(typeof data)[0]>()
      .x(d => xScale(d.timestamp) || 0)
      .y0(innerHeight)
      .y1(d => yScale(d.memoryMB))
      .curve(d3.curveMonotoneX);

    // Gradient for Memory
    const memGradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'mem-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    memGradient.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.35);
    memGradient.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.0);

    svg.append('path').datum(data).attr('fill', 'url(#mem-grad)').attr('d', memoryArea);

    // Line for CPU Load (%)
    const cpuLine = d3
      .line<(typeof data)[0]>()
      .x(d => xScale(d.timestamp) || 0)
      .y(d => yScale(d.cpu * 0.8)) // Scaled visual curve
      .curve(d3.curveMonotoneX);

    // Line for Memory Used (MB)
    const memLine = d3
      .line<(typeof data)[0]>()
      .x(d => xScale(d.timestamp) || 0)
      .y(d => yScale(d.memoryMB))
      .curve(d3.curveMonotoneX);

    // Line for Thread Load
    const threadLine = d3
      .line<(typeof data)[0]>()
      .x(d => xScale(d.timestamp) || 0)
      .y(d => yScale(d.threadLoad * 10))
      .curve(d3.curveMonotoneX);

    // Draw lines
    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2.5)
      .attr('d', memLine);

    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,3')
      .attr('d', cpuLine);

    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('d', threadLine);

    // Circles at latest data point
    const lastPoint = data[data.length - 1];
    if (lastPoint) {
      const lx = xScale(lastPoint.timestamp) || 0;
      svg.append('circle').attr('cx', lx).attr('cy', yScale(lastPoint.memoryMB)).attr('r', 4).attr('fill', '#6366f1');
      svg.append('circle').attr('cx', lx).attr('cy', yScale(lastPoint.cpu * 0.8)).attr('r', 4).attr('fill', '#f43f5e');
      svg.append('circle').attr('cx', lx).attr('cy', yScale(lastPoint.threadLoad * 10)).attr('r', 4).attr('fill', '#10b981');
    }
  }, [report]);

  // 2. Render D3 Request Counter Donut & Breakdown Chart
  useEffect(() => {
    if (!report || !requestChartRef.current) return;

    const svgElement = requestChartRef.current;
    d3.select(svgElement).selectAll('*').remove();

    const width = svgElement.clientWidth || 320;
    const height = 240;
    const radius = Math.min(width, height) / 2 - 20;

    const svg = d3
      .select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const summary = report.summary;
    const pieData = [
      { label: 'Succeeded', value: summary.succeededRequests, color: '#10b981' },
      { label: 'Failed', value: summary.failedRequests, color: '#f43f5e' },
      { label: 'Unknown Cmd', value: summary.unknownCommandRequests, color: '#f59e0b' }
    ];

    const pie = d3.pie<(typeof pieData)[0]>().value(d => Math.max(d.value, summary.totalRequests === 0 ? 1 : 0));
    const arc = d3
      .arc<d3.PieArcDatum<(typeof pieData)[0]>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius);

    const arcs = svg.selectAll('.arc').data(pie(pieData)).enter().append('g').attr('class', 'arc');

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2);

    // Center Text
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', '#f8fafc')
      .attr('font-size', '20px')
      .attr('font-weight', 'bold')
      .text(summary.totalRequests.toLocaleString());

    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .text('TOTAL REQUESTS');
  }, [report]);

  // 3. Render D3 Command Plugin Latency Ranking Horizontal Bar Chart
  useEffect(() => {
    if (!report || !report.commandStats || report.commandStats.length === 0 || !commandLatencyChartRef.current) {
      return;
    }

    const svgElement = commandLatencyChartRef.current;
    d3.select(svgElement).selectAll('*').remove();

    // Show top 8 commands sorted by avg execution time or total executions
    let filteredCmds: CommandStatItem[] = report.commandStats;
    if (filterCategory !== 'ALL') {
      filteredCmds = filteredCmds.filter((c: CommandStatItem) => c.category === filterCategory);
    }
    const topCmds: CommandStatItem[] = filteredCmds.slice(0, 10);

    const width = svgElement.clientWidth || 700;
    const barHeight = 28;
    const height = Math.max(200, topCmds.length * barHeight + 40);
    const margin = { top: 10, right: 60, bottom: 20, left: 110 };
    const innerWidth = width - margin.left - margin.right;

    const svg = d3
      .select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxMs = d3.max(topCmds, (d: CommandStatItem) => Math.max(d.avgExecutionTimeMs, 10)) || 100;
    const xScale = d3.scaleLinear().domain([0, maxMs * 1.15]).range([0, innerWidth]);

    const yScale = d3
      .scaleBand()
      .domain(topCmds.map((d: CommandStatItem) => d.commandName))
      .range([0, topCmds.length * barHeight])
      .padding(0.25);

    // Draw Bars
    svg
      .selectAll('.bar-bg')
      .data(topCmds)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (d: CommandStatItem) => yScale(d.commandName) || 0)
      .attr('width', innerWidth)
      .attr('height', yScale.bandwidth())
      .attr('fill', '#1e293b')
      .attr('rx', 4);

    svg
      .selectAll('.bar-fill')
      .data(topCmds)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (d: CommandStatItem) => yScale(d.commandName) || 0)
      .attr('width', (d: CommandStatItem) => Math.max(4, xScale(d.avgExecutionTimeMs)))
      .attr('height', yScale.bandwidth())
      .attr('fill', (d: CommandStatItem) => {
        if (d.failureCount > 0) return '#f43f5e';
        if (d.avgExecutionTimeMs > 150) return '#f59e0b';
        return '#6366f1';
      })
      .attr('rx', 4);

    // Command Name Labels
    svg
      .selectAll('.label-name')
      .data(topCmds)
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d: CommandStatItem) => (yScale(d.commandName) || 0) + yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#cbd5e1')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text((d: CommandStatItem) => `/${d.commandName}`);

    // Execution Time Value Labels
    svg
      .selectAll('.label-val')
      .data(topCmds)
      .enter()
      .append('text')
      .attr('x', (d: CommandStatItem) => Math.max(4, xScale(d.avgExecutionTimeMs)) + 8)
      .attr('y', (d: CommandStatItem) => (yScale(d.commandName) || 0) + yScale.bandwidth() / 2 + 4)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text((d: CommandStatItem) => `${d.avgExecutionTimeMs} ms (${d.totalExecutions}x)`);
  }, [report, filterCategory]);

  const categories: string[] = Array.from(new Set(report?.commandStats.map((c: CommandStatItem) => c.category) || []));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" /> Bot Health & System Observability Engine
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time D3 analytics tracking command execution speed, request counters, memory heap, and failed routines.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onReset}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700"
            title="Reset performance metrics"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Reset Stats</span>
          </button>
        </div>
      </div>

      {/* Top Request Metrics Cards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Requests */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-indigo-900/40 space-y-1">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" /> Total Requests
            </span>
            <div className="text-xl font-mono font-bold text-slate-100">
              {report.summary.totalRequests.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Processed</span>
          </div>

          {/* Succeeded */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-900/40 space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Succeeded
            </span>
            <div className="text-xl font-mono font-bold text-emerald-400">
              {report.summary.succeededRequests.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-500/80 font-mono">
              {report.summary.successRatePercent}% Rate
            </span>
          </div>

          {/* Failed Requests */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-rose-900/40 space-y-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Failed
            </span>
            <div className="text-xl font-mono font-bold text-rose-400">
              {report.summary.failedRequests.toLocaleString()}
            </div>
            <span className="text-[10px] text-rose-500/80 font-mono">
              {report.failedCommandsList.length} Errors
            </span>
          </div>

          {/* Avg Latency */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-amber-900/40 space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> Avg Speed
            </span>
            <div className="text-xl font-mono font-bold text-slate-100">
              {report.summary.overallAvgExecutionTimeMs} <span className="text-xs text-slate-400">ms</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Per Plugin</span>
          </div>

          {/* Memory Heap */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-purple-900/40 space-y-1">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Server className="w-3 h-3" /> Heap Used
            </span>
            <div className="text-xl font-mono font-bold text-slate-100">
              {report.systemResource.memoryUsageMB} <span className="text-xs text-slate-400">MB</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Total {report.systemResource.heapTotalMB} MB</span>
          </div>

          {/* CPU Load */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-sky-900/40 space-y-1">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
              <Cpu className="w-3 h-3" /> CPU Load
            </span>
            <div className="text-xl font-mono font-bold text-slate-100">
              {report.systemResource.cpuLoadPercent} <span className="text-xs text-slate-400">%</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{report.systemResource.activeThreads} Active Threads</span>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('charts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'charts'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Real-time D3 Visualizers</span>
        </button>

        <button
          onClick={() => setActiveTab('commands')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'commands'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Command Execution Latencies ({report?.commandStats.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('failures')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'failures'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bug className="w-3.5 h-3.5 text-rose-400" />
          <span>Failed Commands ({report?.failedCommandsList.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: REALTIME D3 CHARTS */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Realtime Resource Graph (2 cols) */}
            <div className="lg:col-span-2 bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" /> Real-time System Load & Heap Allocation (D3)
                </span>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Memory (MB)
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> CPU (%)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Thread Load
                  </span>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg ref={resourceChartRef} className="w-full min-w-[500px] h-[240px]"></svg>
              </div>
            </div>

            {/* Request Breakdown Donut (1 col) */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Request Breakdown
                </span>
              </div>

              <div className="flex justify-center items-center my-auto">
                <svg ref={requestChartRef} className="w-[240px] h-[240px]"></svg>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800 text-[10px] font-mono text-center">
                <div className="p-1 rounded bg-emerald-950/30 text-emerald-400 border border-emerald-900/40">
                  <div className="font-bold">{report?.summary.succeededRequests}</div>
                  <div>Succeeded</div>
                </div>
                <div className="p-1 rounded bg-rose-950/30 text-rose-400 border border-rose-900/40">
                  <div className="font-bold">{report?.summary.failedRequests}</div>
                  <div>Failed</div>
                </div>
                <div className="p-1 rounded bg-amber-950/30 text-amber-400 border border-amber-900/40">
                  <div className="font-bold">{report?.summary.unknownCommandRequests}</div>
                  <div>Unknown</div>
                </div>
              </div>
            </div>
          </div>

          {/* Test Simulation Trigger Tool */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <Play className="w-3.5 h-3.5 text-indigo-400" /> Live Command Execution Simulator
              </span>
              <span className="text-[10px] text-slate-400">Inject test requests to observe live D3 updates</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5">
                <span className="text-xs font-mono text-slate-400">/</span>
                <input
                  type="text"
                  value={testCmdInput}
                  onChange={e => setTestCmdInput(e.target.value)}
                  placeholder="command name (e.g. help, ai, admin)"
                  className="w-full bg-transparent text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>

              <button
                onClick={() => onSimulate(testCmdInput || 'help', false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simulate Success</span>
              </button>

              <button
                onClick={() => onSimulate(testCmdInput || 'help', true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Simulate Failure</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMMAND LATENCIES & EXECUTION STATISTICS */}
      {activeTab === 'commands' && (
        <div className="space-y-6">
          {/* Latency Bar Chart */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" /> Command Average Latency Ranking (D3)
              </span>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Category:</span>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg px-2.5 py-1 focus:outline-none"
                >
                  <option value="ALL">ALL CATEGORIES</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg ref={commandLatencyChartRef} className="w-full min-w-[500px]"></svg>
            </div>
          </div>

          {/* Full Detailed Plugin Execution Table */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Registered Plugin Performance Breakdown</span>
              <span className="text-[10px] font-mono text-slate-400">{report?.commandStats.length} total plugins</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Command</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Executions</th>
                    <th className="p-3">Avg Latency</th>
                    <th className="p-3">Min / Max</th>
                    <th className="p-3">Success Rate</th>
                    <th className="p-3">Last Executed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {report?.commandStats.map(cmd => {
                    const rate =
                      cmd.totalExecutions > 0
                        ? Math.round((cmd.successCount / cmd.totalExecutions) * 100)
                        : 100;
                    return (
                      <tr key={cmd.commandName} className="hover:bg-slate-900/60 transition">
                        <td className="p-3 font-bold text-indigo-300">/{cmd.commandName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                            {cmd.category}
                          </span>
                        </td>
                        <td className="p-3 font-bold">{cmd.totalExecutions}</td>
                        <td className="p-3">
                          <span
                            className={`font-bold ${
                              cmd.avgExecutionTimeMs > 200
                                ? 'text-rose-400'
                                : cmd.avgExecutionTimeMs > 80
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {cmd.avgExecutionTimeMs} ms
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {cmd.minExecutionTimeMs}ms / {cmd.maxExecutionTimeMs}ms
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rate === 100
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {rate}% ({cmd.failureCount} fails)
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[10px]">
                          {cmd.lastExecutedAt
                            ? new Date(cmd.lastExecutedAt).toLocaleTimeString()
                            : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FAILED COMMANDS DIAGNOSTICS */}
      {activeTab === 'failures' && (
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-rose-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-200">Failed Commands Routine Inspector</h4>
                <p className="text-[11px] text-slate-400">Detailed error trace of routines that failed to proceed during execution</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs font-bold rounded-xl">
              {report?.failedCommandsList.length || 0} Failures Logged
            </span>
          </div>

          {!report || report.failedCommandsList.length === 0 ? (
            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-300 font-bold">No Command Execution Failures Detected!</p>
              <p className="text-[11px] text-slate-500">All command plugins are completing execution without uncaught errors.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {report.failedCommandsList.map(fail => (
                <div
                  key={fail.id}
                  className="bg-slate-950 p-4 rounded-2xl border border-rose-900/30 hover:border-rose-800/60 transition space-y-2 font-mono"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5" /> /{fail.command}
                    </span>
                    <span className="text-[10px] text-slate-400">{new Date(fail.timestamp).toLocaleString()}</span>
                  </div>

                  <div className="p-2.5 bg-rose-950/30 border border-rose-900/40 rounded-xl text-xs text-rose-200 font-mono">
                    {fail.error}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>
                      User: <strong className="text-slate-300">{fail.userId}</strong> | Thread: <strong className="text-slate-300">{fail.groupId}</strong>
                    </span>
                    <button
                      onClick={() => onSimulate(fail.command, false)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-sans font-bold transition flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 text-indigo-400" />
                      <span>Retry Command</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
