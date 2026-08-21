import { accountRuntimeLogManager } from './src/services/AccountRuntimeLogManager';
console.log(JSON.stringify(accountRuntimeLogManager.getAccountLogs('acc_61557764854867', 'ALL'), null, 2));
process.exit(0);
