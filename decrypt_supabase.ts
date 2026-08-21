import fs from 'fs';
import { decrypt } from './src/utils/crypto.js';

const backupPath = './storage/settings/supabase_credentials.enc.json';
const content = fs.readFileSync(backupPath, 'utf8');
const data = JSON.parse(content);
console.log(decrypt(data.payload));
