const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'services', 'SupabaseService.ts');
let content = fs.readFileSync(p, 'utf8');

// replace loadConfigFromDB
const newLoadConfig = `
  public async loadConfigFromDB(): Promise<void> {
    try {
      const doc = await SystemCredentialModel.findOne({ key: 'SUPABASE_CONFIG', active: true }).sort({ version: -1 }).lean();
      if (doc && doc.config) {
        let decryptedConfig = doc.config;
        if (typeof doc.config === 'string') {
          try {
            decryptedConfig = JSON.parse(decrypt(doc.config));
          } catch(e) {
            console.error('Failed to decrypt supabase config');
            decryptedConfig = {};
          }
        }
        
        if (decryptedConfig && typeof decryptedConfig === 'object') {
          this.config = { ...this.config, ...decryptedConfig };
          this.reinitializeClient();
        }
      } else {
        // Fallback to old BotSettingModel
        const oldDoc = await BotSettingModel.findOne({ key: 'SUPABASE_CONFIG' } as any).lean();
        if (oldDoc && oldDoc.value) {
          this.config = { ...this.config, ...oldDoc.value };
          this.reinitializeClient();
          // migrate to new format
          await this.saveConfig(this.config);
        }
      }
    } catch (err) {
      console.error('[SupabaseService] Failed to load config from DB:', err);
    }
  }
`;
content = content.replace(/public async loadConfigFromDB\(\): Promise<void> \{[\s\S]*?\n  \}/, newLoadConfig.trim());

// replace saveConfig
const newSaveConfig = `
  public async saveConfig(newConfig: Partial<SupabaseConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    try {
      const encryptedConfig = encrypt(JSON.stringify(this.config));
      
      const latestDoc = await SystemCredentialModel.findOne({ key: 'SUPABASE_CONFIG' }).sort({ version: -1 }).lean();
      const nextVersion = latestDoc ? latestDoc.version + 1 : 1;
      
      await SystemCredentialModel.updateMany({ key: 'SUPABASE_CONFIG' }, { $set: { active: false } });
      
      await SystemCredentialModel.create({
        key: 'SUPABASE_CONFIG',
        version: nextVersion,
        active: true,
        config: encryptedConfig,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'admin',
        lastValidatedAt: Date.now(),
        lastValidationStatus: 'VALID'
      });
      
      this.reinitializeClient();
    } catch (err) {
      console.error('[SupabaseService] Failed to save config to DB:', err);
      throw err;
    }
  }
`;
content = content.replace(/public async saveConfig\(newConfig: Partial<SupabaseConfig>\): Promise<void> \{[\s\S]*?\n  \}/, newSaveConfig.trim());

fs.writeFileSync(p, content);
console.log('patched config methods');
