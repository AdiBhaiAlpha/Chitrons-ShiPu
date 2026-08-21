import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import os from 'os';
import path from 'path';

/**
 * Generates a clean, modern ping status image
 */
export async function generatePingImage(latency: number, serverTime: string): Promise<Buffer> {
  const width = 600;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background - Dark Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0f172a'); // slate-900
  grad.addColorStop(1, '#1e293b'); // slate-800
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Decorative border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Title
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('SHIPU AI SYSTEM STATUS', 40, 60);

  // Ping Circle Background
  ctx.beginPath();
  ctx.arc(100, 160, 50, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
  ctx.fill();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ping Value
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${latency}`, 100, 165);
  ctx.font = 'bold 10px Arial';
  ctx.fillText('MS', 100, 185);

  // Main Info
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('PONG!', 180, 140);
  
  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 18px Arial';
  ctx.fillText(`Latency: ${latency}ms`, 180, 175);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px Arial';
  ctx.fillText(`Server Time: ${serverTime}`, 180, 210);

  // Status Bar
  const statusColor = latency < 50 ? '#10b981' : latency < 150 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(40, 260, 6, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('SYSTEM READY', 60, 264);

  return canvas.toBuffer('image/png');
}

/**
 * Interface for the massive amount of data required for the monitor dashboard
 */
export interface MonitorDashboardData {
  botInfo: {
    name: string;
    version: string;
    framework: string;
    author: string;
    prefix: string;
    env: string;
    platform: string;
    pid: string;
    node: string;
    ts: string;
    gitBranch: string;
    commitHash: string;
  };
  system: {
    cpuModel: string;
    cpuUsage: number;
    cores: number;
    loadAvg: number[];
    ramTotal: number;
    ramUsed: number;
    ramFree: number;
    ramUsagePercent: number;
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    diskTotal: number;
    diskUsed: number;
    diskFree: number;
  };
  performance: {
    uptime: string;
    bootTime: string;
    commandsLoaded: number;
    eventsLoaded: number;
    pluginsLoaded: number;
    cacheSize: string;
    hotReload: string;
    ftpSync: string;
    database: string;
    mongoPing: string;
    collections: number;
    users: number;
    threads: number;
    memories: number;
    brainEntries: number;
    pendingJobs: number;
    scheduledTasks: number;
  };
  network: {
    ping: number;
    messengerLatency: number;
    avgLatency: number;
    httpRequests: number;
    rps: number;
    downloadSpeed: string;
    uploadSpeed: string;
    internetStatus: string;
    publicIp: string;
    location: string;
  };
  aiEngine: {
    provider: string;
    model: string;
    providerStatus: string;
    brainStatus: string;
    memoryLoaded: number;
    contextWindow: string;
    requestsToday: number;
    successRequests: number;
    failedRequests: number;
    avgResponseTime: string;
    tokensUsed: string;
  };
  liveStats: {
    commandsToday: number;
    cpm: number;
    msgReceived: number;
    msgSent: number;
    repliesSent: number;
    imagesGenerated: number;
    editedImages: number;
    filesUploaded: number;
    activeAiSessions: number;
    teachingToday: number;
  };
  cache: {
    size: string;
    tempFiles: number;
    imagesCached: number;
    filesCleaned: number;
    autoCleanup: string;
  };
  security: {
    admins: number;
    bans: number;
    blocked: number;
    permLevel: string;
    failedLogins: number;
    rateLimiter: string;
  };
  services: {
    messenger: 'ONLINE' | 'WARNING' | 'OFFLINE';
    mongodb: 'ONLINE' | 'WARNING' | 'OFFLINE';
    ftpSync: 'ONLINE' | 'WARNING' | 'OFFLINE';
    backup: 'ONLINE' | 'WARNING' | 'OFFLINE';
    brain: 'ONLINE' | 'WARNING' | 'OFFLINE';
    memory: 'ONLINE' | 'WARNING' | 'OFFLINE';
    scheduler: 'ONLINE' | 'WARNING' | 'OFFLINE';
    aiService: 'ONLINE' | 'WARNING' | 'OFFLINE';
    loader: 'ONLINE' | 'WARNING' | 'OFFLINE';
    hotReload: 'ONLINE' | 'WARNING' | 'OFFLINE';
  };
  footer: {
    genTime: string;
    timezone: string;
    renderTime: string;
    version: string;
    resolution: string;
  };
}

/**
 * Generates an enterprise-grade monitoring dashboard infographic
 */
export async function generateMonitorDashboard(data: MonitorDashboardData): Promise<Buffer> {
  const width = 1600;
  const height = 2200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Helper: Draw rounded rect
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // 1. Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#020617'); // slate-950
  bgGrad.addColorStop(0.5, '#0f172a'); // slate-900
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 80) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
  }
  for (let j = 0; j < height; j += 80) {
    ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke();
  }

  // 2. Header
  const headerY = 80;
  ctx.fillStyle = '#6366f1'; // Indigo-500
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('SHIPU AI', 80, headerY + 60);
  
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('ENTERPRISE MONITORING SYSTEM', 80, headerY + 110);
  
  // Status Pulse
  ctx.fillStyle = '#10b981';
  ctx.beginPath(); ctx.arc(width - 450, headerY + 80, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.beginPath(); ctx.arc(width - 450, headerY + 80, 16, 0, Math.PI * 2); ctx.fill();
  
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('SYSTEM STATUS: OPTIMAL', width - 425, headerY + 87);

  // 3. Section Drawing Helper
  const drawCard = (x: number, y: number, w: number, h: number, title: string) => {
    // Glassmorphism effect
    ctx.save();
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    roundRect(x, y, w, h, 24);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 24);
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(title.toUpperCase(), x + 30, y + 50);
    
    // Divider
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.beginPath(); ctx.moveTo(x + 30, y + 70); ctx.lineTo(x + w - 30, y + 70); ctx.stroke();
    ctx.restore();
  };

  const drawInfoRow = (x: number, y: number, label: string, value: string | number, color: string = '#f1f5f9') => {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(label, x, y);
    
    ctx.fillStyle = color;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(String(value), x + 320, y);
    ctx.textAlign = 'left';
  };

  const drawProgressBar = (x: number, y: number, w: number, percent: number, label: string, valueStr: string) => {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(label, x, y);
    ctx.textAlign = 'right';
    ctx.fillText(valueStr, x + w, y);
    ctx.textAlign = 'left';
    
    // Track
    ctx.fillStyle = '#1e293b';
    roundRect(x, y + 15, w, 12, 6);
    ctx.fill();
    
    // Bar
    const barWidth = (w * Math.min(100, percent)) / 100;
    const barGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    barGrad.addColorStop(0, '#6366f1');
    barGrad.addColorStop(1, '#a855f7');
    ctx.fillStyle = barGrad;
    roundRect(x, y + 15, barWidth, 12, 6);
    ctx.fill();
  };

  const drawBadge = (x: number, y: number, label: string, status: 'ONLINE' | 'WARNING' | 'OFFLINE') => {
    const color = status === 'ONLINE' ? '#10b981' : status === 'WARNING' ? '#f59e0b' : '#ef4444';
    const bg = status === 'ONLINE' ? 'rgba(16, 185, 129, 0.1)' : status === 'WARNING' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    
    ctx.fillStyle = bg;
    roundRect(x, y, 140, 32, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    roundRect(x, y, 140, 32, 16);
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 20, y + 16, 4, 0, Math.PI * 2); ctx.fill();
    
    ctx.font = 'bold 12px Arial';
    ctx.fillText(label, x + 35, y + 21);
  };

  // Layout Grid
  const col1 = 80;
  const col2 = 590;
  const col3 = 1100;
  const cardW = 480;

  // SECTION 1: BOT INFO (Top Row)
  drawCard(col1, 250, cardW, 400, 'Bot Information');
  let ry = 330;
  drawInfoRow(col1 + 30, ry, 'Bot Name', data.botInfo.name); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Version', data.botInfo.version); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Framework', data.botInfo.framework); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Author', data.botInfo.author); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Prefix', data.botInfo.prefix); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Env', data.botInfo.env, '#38bdf8'); ry += 35;
  drawInfoRow(col1 + 30, ry, 'PID', data.botInfo.pid); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Node.js', data.botInfo.node);

  // SECTION 2: SYSTEM INFO
  drawCard(col2, 250, cardW, 400, 'System Resources');
  ry = 320;
  drawProgressBar(col2 + 30, ry, 420, data.system.cpuUsage, 'CPU Usage', `${data.system.cpuUsage}%`); ry += 60;
  drawProgressBar(col2 + 30, ry, 420, data.system.ramUsagePercent, 'RAM Usage', `${data.system.ramUsed}MB / ${data.system.ramTotal}MB`); ry += 60;
  drawProgressBar(col2 + 30, ry, 420, (data.system.diskUsed / data.system.diskTotal) * 100, 'Disk Space', `${data.system.diskUsed}GB / ${data.system.diskTotal}GB`); ry += 60;
  
  ctx.fillStyle = '#64748b'; ctx.font = 'bold 14px Arial'; ctx.fillText('CPU Model:', col2 + 30, ry);
  ctx.fillStyle = '#cbd5e1'; ctx.font = '13px Arial'; ctx.fillText(data.system.cpuModel.substring(0, 45), col2 + 30, ry + 25);
  ry += 50;
  drawInfoRow(col2 + 30, ry, 'Cores', data.system.cores); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Load Avg', data.system.loadAvg.join(' '));

  // SECTION 3: PERFORMANCE
  drawCard(col3, 250, cardW, 400, 'Bot Performance');
  ry = 330;
  drawInfoRow(col3 + 30, ry, 'Uptime', data.performance.uptime, '#10b981'); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Boot Time', data.performance.bootTime); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Commands', data.performance.commandsLoaded); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Plugins', data.performance.pluginsLoaded); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Collections', data.performance.collections); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Users', data.performance.users); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Threads', data.performance.threads); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Brain Entries', data.performance.brainEntries);

  // SECTION 4: NETWORK
  drawCard(col1, 680, cardW, 400, 'Network & Connectivity');
  ry = 760;
  drawInfoRow(col1 + 30, ry, 'Current Ping', `${data.network.ping}ms`, data.network.ping < 50 ? '#10b981' : '#f59e0b'); ry += 35;
  drawInfoRow(col1 + 30, ry, 'API Latency', `${data.network.messengerLatency}ms`); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Avg Latency', `${data.network.avgLatency}ms`); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Requests/sec', data.network.rps); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Public IP', data.network.publicIp); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Location', data.network.location); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Internet', data.network.internetStatus, '#10b981'); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Down/Up', `${data.network.downloadSpeed} / ${data.network.uploadSpeed}`);

  // SECTION 5: AI ENGINE
  drawCard(col2, 680, cardW, 400, 'AI Engine Stats');
  ry = 760;
  drawInfoRow(col2 + 30, ry, 'Provider', data.aiEngine.provider); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Model', data.aiEngine.model, '#818cf8'); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Status', data.aiEngine.providerStatus, '#10b981'); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Memory', `${data.aiEngine.memoryLoaded} items`); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Req Today', data.aiEngine.requestsToday); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Success', data.aiEngine.successRequests, '#10b981'); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Failed', data.aiEngine.failedRequests, '#ef4444'); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Avg Resp', data.aiEngine.avgResponseTime); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Tokens', data.aiEngine.tokensUsed);

  // SECTION 6: LIVE STATISTICS
  drawCard(col3, 680, cardW, 400, 'Live Activity');
  ry = 760;
  drawInfoRow(col3 + 30, ry, 'Cmds Today', data.liveStats.commandsToday); ry += 35;
  drawInfoRow(col3 + 30, ry, 'CPM', data.liveStats.cpm); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Msg Rcvd', data.liveStats.msgReceived); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Msg Sent', data.liveStats.msgSent); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Replies', data.liveStats.repliesSent); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Images Gen', data.liveStats.imagesGenerated); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Active Sessions', data.liveStats.activeAiSessions); ry += 35;
  drawInfoRow(col3 + 30, ry, 'Teachings', data.liveStats.teachingToday);

  // SECTION 7: CACHE & SECTION 8: SECURITY (Combined in Row 3)
  drawCard(col1, 1110, cardW, 350, 'Cache & Storage');
  ry = 1190;
  drawInfoRow(col1 + 30, ry, 'Cache Size', data.cache.size); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Temp Files', data.cache.tempFiles); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Images Cached', data.cache.imagesCached); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Files Cleaned', data.cache.filesCleaned); ry += 35;
  drawInfoRow(col1 + 30, ry, 'Auto Cleanup', data.cache.autoCleanup, '#10b981');

  drawCard(col2, 1110, cardW, 350, 'Security Status');
  ry = 1190;
  drawInfoRow(col2 + 30, ry, 'Admins', data.security.admins, '#f59e0b'); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Global Bans', data.security.bans, '#ef4444'); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Blocked Users', data.security.blocked); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Perm Level', data.security.permLevel); ry += 35;
  drawInfoRow(col2 + 30, ry, 'Rate Limiter', data.security.rateLimiter, '#10b981');

  // SECTION 9: LIVE SERVICES (Large Bottom Card)
  drawCard(col3, 1110, cardW, 350, 'Infrastructure');
  ry = 1180;
  drawBadge(col3 + 30, ry, 'MESSENGER', data.services.messenger); 
  drawBadge(col3 + 240, ry, 'MONGODB', data.services.mongodb); ry += 50;
  drawBadge(col3 + 30, ry, 'FTP SYNC', data.services.ftpSync);
  drawBadge(col3 + 240, ry, 'BRAIN', data.services.brain); ry += 50;
  drawBadge(col3 + 30, ry, 'AI SERVICE', data.services.aiService);
  drawBadge(col3 + 240, ry, 'MEMORY', data.services.memory); ry += 50;
  drawBadge(col3 + 30, ry, 'LOADER', data.services.loader);
  drawBadge(col3 + 240, ry, 'SCHEDULER', data.services.scheduler); ry += 50;
  drawBadge(col3 + 30, ry, 'RELOAD', data.services.hotReload);
  drawBadge(col3 + 240, ry, 'BACKUP', data.services.backup);

  // SECTION 10: MINI GRAPHS (Just simple stylized lines)
  const drawMiniGraph = (x: number, y: number, w: number, h: number, points: number[], color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const step = w / (points.length - 1);
    ctx.moveTo(x, y + h - (points[0] / 100) * h);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(x + i * step, y + h - (points[i] / 100) * h);
    }
    ctx.stroke();
    
    // Gradient fill
    const fill = ctx.createLinearGradient(0, y, 0, y + h);
    fill.addColorStop(0, color.replace(')', ', 0.3)'));
    fill.addColorStop(1, color.replace(')', ', 0)'));
    ctx.fillStyle = fill;
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.fill();
  };

  drawCard(col1, 1490, width - 160, 450, 'System Health Analytics (24h Trend)');
  drawMiniGraph(col1 + 50, 1580, 450, 280, [10, 15, 8, 25, 40, 30, 20, 15, 10, 5, 12, 18], 'rgba(99, 102, 241, 1)');
  ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 14px Arial'; ctx.fillText('CPU LOAD', col1 + 50, 1880);
  
  drawMiniGraph(col1 + 550, 1580, 450, 280, [40, 42, 41, 45, 50, 48, 47, 49, 52, 51, 53, 55], 'rgba(168, 85, 247, 1)');
  ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 14px Arial'; ctx.fillText('MEMORY (HEAP)', col1 + 550, 1880);

  drawMiniGraph(col1 + 1050, 1580, 350, 280, [2, 5, 1, 8, 12, 4, 3, 7, 9, 2, 5, 4], 'rgba(16, 185, 129, 1)');
  ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 14px Arial'; ctx.fillText('REQUESTS / MIN', col1 + 1050, 1880);

  // FOOTER
  const footerY = 2050;
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
  ctx.beginPath(); ctx.moveTo(80, footerY); ctx.lineTo(width - 80, footerY); ctx.stroke();
  
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Generated: ${data.footer.genTime} (${data.footer.timezone})`, 80, footerY + 40);
  ctx.fillText(`Render: ${data.footer.renderTime}ms | Monitor v${data.footer.version}`, 80, footerY + 65);
  
  ctx.textAlign = 'right';
  ctx.fillText(`Resolution: ${data.footer.resolution} | SHIPU AI OS`, width - 80, footerY + 40);
  ctx.fillText('DESIGNED BY CHITRON BHATTACHARJEE', width - 80, footerY + 65);

  return canvas.toBuffer('image/png');
}
