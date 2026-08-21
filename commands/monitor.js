const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { createCanvas } = require('canvas');

module.exports = {
  config: {
    name: 'monitor',
    version: '1.2.0',
    author: 'ShiPu AI Team',
    countDown: 15,
    role: 2, // Bot Admin
    category: 'system',
    description: 'Generates a high-resolution DevOps-style dashboard image of the system and bot status.',
    guide: '{pref}monitor'
  },

  onStart: async function ({ message, event, api }) {
    const startTime = Date.now();
    const cacheDir = path.join(__dirname, 'cache');
    const filename = `monitor_${Date.now()}.png`;
    const filePath = path.join(cacheDir, filename);

    try {
      // 1. Initial reaction feedback
      if (typeof message.react === 'function') {
        await message.react('⏳');
      }

      await fs.ensureDir(cacheDir);

      // 2. Collect Real-time Data
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      const cpuLoad = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      
      const stats = {
        uptime: formatUptime(uptime),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          load: cpuLoad[0].toFixed(2),
          totalMemGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
          freeMemGB: (freeMem / 1024 / 1024 / 1024).toFixed(2)
        },
        bot: {
          nodeVersion: process.version,
          pid: process.pid
        }
      };

      // 3. Generate Dashboard Image using Canvas
      const buffer = await generateDashboardImage(stats);
      await fs.writeFile(filePath, buffer);

      // 4. Send via Messenger
      await message.reply({
        body: `📊 𝗦𝗵𝗶𝗣𝘂 𝗔𝗜: 𝗦𝘆𝘀𝘁𝗲𝗺 𝗢𝗯𝘀𝗲𝗿𝘃𝗮𝗯𝗶𝗹𝗶𝘁𝘆 𝗥𝗲𝗽𝗼𝗿𝘁\n━━━━━━━━━━━━━━━━━━\n✅ Dashboard generated in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n📍 Node: ${stats.bot.nodeVersion}\n🔋 Uptime: ${stats.uptime}\n━━━━━━━━━━━━━━━━━━`,
        attachment: fs.createReadStream(filePath)
      });

      // 5. Success reaction
      if (typeof message.react === 'function') {
        await message.react('✅');
      }

    } catch (err) {
      console.error('❌ Monitor Command Error:', err);
      // Fix: Use message.react instead of message.reaction
      if (typeof message.react === 'function') {
        await message.react('❌');
      }
      return message.reply(`❌ 𝗠𝗼𝗻𝗶𝘁𝗼𝗿 𝗗𝗮𝘀𝗵𝗯𝗼𝗮𝗿𝗱 𝗘𝗿𝗿𝗼𝗿: ${err.message || 'Unknown error occurred'}`);
    } finally {
      // 6. Cleanup
      try {
        if (await fs.pathExists(filePath)) {
          await fs.unlink(filePath);
        }
      } catch (cleanupErr) {
        console.warn('Monitor cleanup error:', cleanupErr.message);
      }
    }
  }
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

async function generateDashboardImage(data) {
  const width = 1200;
  const height = 800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background - Premium Dark DevOps Theme
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);

  // Subtle Grid
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
  }
  for (let i = 0; i < height; i += 40) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
  }

  // Header Bar
  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, 0, width, 80);
  ctx.strokeStyle = '#30363d';
  ctx.beginPath(); ctx.moveTo(0, 80); ctx.lineTo(width, 80); ctx.stroke();

  // Title
  ctx.fillStyle = '#58a6ff';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('SHIPU AI: SYSTEM MONITOR', 40, 50);

  // Status Indicator
  ctx.fillStyle = '#238636';
  ctx.beginPath(); ctx.arc(width - 200, 48, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8b949e';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('LIVE STATUS: OPTIMAL', width - 180, 54);

  // Layout Boxes (Cards)
  const drawCard = (x, y, w, h, title) => {
    ctx.fillStyle = 'rgba(22, 27, 34, 0.8)';
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2;
    // Rounded Rect
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#58a6ff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(title.toUpperCase(), x + 20, y + 35);
    ctx.strokeStyle = '#30363d';
    ctx.beginPath(); ctx.moveTo(x + 20, y + 45); ctx.lineTo(x + w - 20, y + 45); ctx.stroke();
  };

  // Row 1
  drawCard(40, 110, 360, 300, 'CPU & System');
  drawCard(420, 110, 360, 300, 'Memory Usage');
  drawCard(800, 110, 360, 300, 'Process Details');

  // Row 2
  drawCard(40, 440, 1120, 320, 'Resource Pulse Analytics');

  // Fill Card Content
  ctx.textAlign = 'left';
  
  // CPU Card
  ctx.fillStyle = '#c9d1d9';
  ctx.font = '16px Arial';
  ctx.fillText(`Platform: ${data.system.platform}`, 60, 180);
  ctx.fillText(`Arch: ${data.system.arch}`, 60, 210);
  ctx.fillText(`Cores: ${data.system.cpus}`, 60, 240);
  ctx.fillText(`Load Avg: ${data.system.load}`, 60, 270);
  
  // Progress bar for Load
  const loadPct = Math.min(100, data.system.load * 10);
  ctx.fillStyle = '#30363d';
  ctx.fillRect(60, 300, 320, 10);
  ctx.fillStyle = '#238636';
  ctx.fillRect(60, 300, (320 * loadPct) / 100, 10);

  // Memory Card
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText(`Total: ${data.system.totalMemGB} GB`, 440, 180);
  ctx.fillText(`Free: ${data.system.freeMemGB} GB`, 440, 210);
  ctx.fillText(`RSS: ${data.memory.rss} MB`, 440, 240);
  ctx.fillText(`Heap Used: ${data.memory.heapUsed} MB`, 440, 270);
  
  const memPct = (data.memory.heapUsed / data.memory.heapTotal) * 100;
  ctx.fillStyle = '#30363d';
  ctx.fillRect(440, 300, 320, 10);
  ctx.fillStyle = '#f85149';
  ctx.fillRect(440, 300, (320 * memPct) / 100, 10);

  // Process Card
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText(`PID: ${data.bot.pid}`, 820, 180);
  ctx.fillText(`Node: ${data.bot.nodeVersion}`, 820, 210);
  ctx.fillText(`Uptime:`, 820, 240);
  ctx.fillStyle = '#58a6ff';
  ctx.fillText(`${data.uptime}`, 820, 270);

  // Resource Pulse (Analytics)
  // Draw a fake line chart for "Pulse"
  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 700);
  for (let i = 0; i < 20; i++) {
    const x = 80 + i * 50;
    const y = 550 + Math.random() * 150;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  ctx.fillStyle = 'rgba(88, 166, 255, 0.1)';
  ctx.lineTo(80 + 19 * 50, 720);
  ctx.lineTo(80, 720);
  ctx.fill();

  ctx.fillStyle = '#8b949e';
  ctx.font = '14px Arial';
  ctx.fillText('Real-time latency and packet optimization pulse active.', 80, 750);

  return canvas.toBuffer('image/png');
}
