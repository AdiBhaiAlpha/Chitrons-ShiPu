const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'services', 'SupabaseService.ts');
let content = fs.readFileSync(p, 'utf8');

const networkMethods = `
  public async checkNetworkMode(): Promise<{ mode: string, message: string }> {
    if (!this.config.dbConnectionString) return { mode: 'ipv4', message: 'No connection string' };
    try {
      const url = new URL(this.config.dbConnectionString);
      let host = url.hostname;
      
      const records = await dns.resolve6(host).catch(() => []);
      if (records.length === 0) {
        return { mode: 'ipv4', message: 'No IPv6 AAAA records found for host' };
      }
      
      return await new Promise((resolve) => {
        const socket = net.createConnection({ host: records[0], port: parseInt(url.port || '5432'), family: 6, timeout: 5000 }, () => {
          socket.destroy();
          resolve({ mode: 'ipv6', message: 'IPv6 is fully available and preferred' });
        });
        socket.on('timeout', () => {
          socket.destroy();
          if (this.config.networkMode === 'ipv6') resolve({ mode: 'IPV6_UNAVAILABLE', message: 'IPv6 connection timed out, runtime does not expose usable IPv6 connectivity.' });
          else resolve({ mode: 'ipv4', message: 'IPv6 connection timed out, falling back to IPv4' });
        });
        socket.on('error', (err) => {
          if (this.config.networkMode === 'ipv6') resolve({ mode: 'IPV6_UNAVAILABLE', message: 'IPv6 connection failed: ' + err.message + ', runtime does not expose usable IPv6 connectivity.' });
          else resolve({ mode: 'ipv4', message: 'IPv6 connection failed, falling back to IPv4' });
        });
      });
    } catch(err: any) {
      return { mode: 'ipv4', message: 'Failed to parse connection string or resolve DNS' };
    }
  }

  public async getStatusDetails(): Promise<any> {
    const isConfigured = this.isConfigured();
    let isConnected = false;
    let latency = 0;
    let tableStatuses: any[] = [];
    let realtimeHealth = 'DISCONNECTED';
    let dbHealth = 'DISCONNECTED';
    let errorMsg = '';
    let networkMode = 'auto';
    let networkMessage = '';
    let configStatus = isConfigured ? 'Configured' : 'Missing';
    
    // Check network mode
    const networkResult = await this.checkNetworkMode();
    networkMode = networkResult.mode;
    networkMessage = networkResult.message;

    if (isConfigured) {
      const connTest = await this.testConnection();
      isConnected = connTest.success;
      latency = connTest.latency;
      errorMsg = connTest.error || '';

      if (isConnected) {
        dbHealth = 'CONNECTED';
        realtimeHealth = this.config.realtimeEnabled ? 'CONNECTED' : 'DISCONNECTED';

        // Check tables status
        try {
          const tablesList = [
            'client_bot_sessions',
            'client_bot_queue',
            'client_bot_logs',
            'client_bot_heartbeats',
            'client_bot_metrics',
            'client_bot_events',
            'client_bot_runtime',
            'client_bot_errors'
          ];
          for (const t of tablesList) {
            try {
              if (this.config.dbConnectionString) {
                const res = await this.runQuery(\`SELECT COUNT(*) FROM \${t};\`);
                tableStatuses.push({ name: t, exists: true, rows: parseInt(res[0]?.count || '0', 10) });
              } else {
                const res = await axios.head(\`\${this.config.projectUrl}/rest/v1/\${t}\`, {
                  headers: {
                    apikey: this.config.serviceRoleKey,
                    Authorization: \`Bearer \${this.config.serviceRoleKey}\`,
                    Prefer: 'count=exact'
                  },
                  timeout: 5000
                });
                const range = res.headers['content-range'] || '';
                const count = range.split('/')[1] || 0;
                tableStatuses.push({ name: t, exists: true, rows: parseInt(count, 10) });
              }
            } catch (err: any) {
               // Table doesn't exist or permission denied
               tableStatuses.push({ name: t, exists: false, rows: 0 });
            }
          }
        } catch (err) {
          console.error('[SupabaseService] Failed to check tables:', err);
        }
      } else {
        errorMsg = 'Connection failed: ' + errorMsg;
      }
    }

    // Get config backup info
    let backupStatus = 'Not Backed Up';
    let version = 0;
    let lastValidatedAt = null;
    try {
      const doc = await SystemCredentialModel.findOne({ key: 'SUPABASE_CONFIG', active: true }).lean();
      if (doc) {
        backupStatus = 'Backed Up';
        version = doc.version || 1;
        lastValidatedAt = doc.lastValidatedAt;
      }
    } catch(e) {}

    return {
      isConfigured,
      isConnected,
      latency,
      dbHealth,
      realtimeHealth,
      tableStatuses,
      errorMsg,
      realtimeEnabled: this.config.realtimeEnabled,
      networkMode,
      networkMessage,
      backupStatus,
      version,
      lastValidatedAt,
      configStatus
    };
  }
`;

content = content.replace(/public async getStatusDetails\(\): Promise<any> \{[\s\S]*?    return \{[\s\S]*?    \};\n  \}/, networkMethods.trim());

fs.writeFileSync(p, content);
console.log('patched status details');
