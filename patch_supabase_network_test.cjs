const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'services', 'SupabaseService.ts');
let content = fs.readFileSync(p, 'utf8');

const newTestConnection = `
  public async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, latency: 0, error: 'Supabase is not configured.' };
    }
    const start = Date.now();
    try {
      const netCheck = await this.checkNetworkMode();
      if (this.config.networkMode === 'ipv6' && netCheck.mode !== 'ipv6') {
         return { success: false, latency: 0, error: netCheck.message };
      }

      if (this.config.dbConnectionString) {
        await this.runQuery('SELECT 1;');
      } else {
        // Fallback to testing REST API via GET
        await axios.get(\`\${this.config.projectUrl}/rest/v1/\`, {
          headers: {
            apikey: this.config.anonKey || this.config.serviceRoleKey,
            Authorization: \`Bearer \${this.config.anonKey || this.config.serviceRoleKey}\`
          },
          timeout: 10000
        });
      }
      const latency = Date.now() - start;
      return { success: true, latency };
    } catch (err: any) {
      return { success: false, latency: 0, error: err.message };
    }
  }
`;

content = content.replace(/public async testConnection\(\): Promise<\{ success: boolean; latency: number; error\?: string \}> \{[\s\S]*?  \}/, newTestConnection.trim());

fs.writeFileSync(p, content);
console.log('patched testConnection');
