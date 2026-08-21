const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src', 'db', 'mongodb.ts');
let content = fs.readFileSync(p, 'utf8');

const credentialSchema = `
const systemCredentialSchema = new mongoose.Schema({
  key: { type: String, required: true },
  version: { type: Number, required: true },
  active: { type: Boolean, default: false },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Number },
  updatedAt: { type: Number },
  createdBy: { type: String },
  lastValidatedAt: { type: Number },
  lastValidationStatus: { type: String }
});
systemCredentialSchema.index({ key: 1, version: 1 }, { unique: true });
`;

if (!content.includes('systemCredentialSchema')) {
  content = content.replace('const botSettingSchema =', credentialSchema + '\nconst botSettingSchema =');
  const exportModel = `export const SystemCredentialModel = mongoose.models.SystemCredential || mongoose.model('SystemCredential', systemCredentialSchema);`;
  content = content.replace('export const BotSettingModel =', exportModel + '\nexport const BotSettingModel =');
  fs.writeFileSync(p, content);
  console.log('patched');
} else {
  console.log('already patched');
}
