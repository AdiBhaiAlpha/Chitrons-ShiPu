const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const distServer = path.join(__dirname, 'dist', 'server.cjs');

if (!fs.existsSync(distServer)) {
  console.log('[PROD/START] dist/server.cjs missing, running automatic build step...');
  try {
    cp.execSync('npx vite build && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', {
      stdio: 'inherit',
      cwd: __dirname
    });
  } catch (err) {
    console.error('[PROD/START] Build failed, falling back to tsx server.ts...', err.message);
    const tsxProcess = cp.spawn('npx', ['tsx', 'server.ts'], { stdio: 'inherit', cwd: __dirname });
    tsxProcess.on('exit', (code) => process.exit(code || 0));
    return;
  }
}

if (fs.existsSync(distServer)) {
  console.log('[PROD/START] Loading compiled bundle dist/server.cjs...');
  require(distServer);
} else {
  console.log('[PROD/START] Starting via tsx server.ts...');
  const tsxProcess = cp.spawn('npx', ['tsx', 'server.ts'], { stdio: 'inherit', cwd: __dirname });
  tsxProcess.on('exit', (code) => process.exit(code || 0));
}
