import fs from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import { createRequire } from 'module';

const nativeRequire = typeof require !== 'undefined'
  ? require
  : createRequire(typeof __filename !== 'undefined' ? __filename : path.join(process.cwd(), 'index.js'));

export interface PackageValidationResult {
  valid: boolean;
  resolvedName?: string;
  version?: string;
  error?: string;
}

export interface DependencyAuditReport {
  alreadyInstalled: string[];
  newlyAdded: string[];
  skippedBuiltins: string[];
  invalidOrMissingNpm: string[];
  commandDependencyMap: Record<string, string[]>;
  installedVersions: Record<string, string>;
  notes: string[];
}

export interface AutoInstallResult {
  installed: string[];
  failed: string[];
  alreadyInstalled: string[];
  skippedBuiltins: string[];
  invalidPackages: string[];
}

export class DependencyManager {
  private static instance: DependencyManager;

  // Set of standard Node.js built-in modules
  private readonly builtinModules = new Set<string>([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
    'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
    'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
    'module', 'net', 'os', 'path', 'path/posix', 'path/win32', 'perf_hooks',
    'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
    'stream/promises', 'stream/web', 'string_decoder', 'sys', 'timers',
    'timers/promises', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
    'worker_threads', 'zlib'
  ]);

  private isInstalling = false;
  private installQueue: Array<() => void> = [];
  private failedInstallsCache = new Set<string>(['discord-image-generation']);

  public isFailedInstall(packageName: string): boolean {
    if (!packageName) return false;
    const norm = this.normalizePackageName(packageName);
    return this.failedInstallsCache.has(norm);
  }

  public static getInstance(): DependencyManager {
    if (!DependencyManager.instance) {
      DependencyManager.instance = new DependencyManager();
    }
    return DependencyManager.instance;
  }

  /**
   * Check if a module is a Node.js built-in module
   */
  public isNodeBuiltin(moduleName: string): boolean {
    if (!moduleName) return false;
    const clean = moduleName.trim().replace(/^node:/, '').toLowerCase();
    return this.builtinModules.has(clean) || clean.startsWith('node:');
  }

  /**
   * Check if an npm package is currently installed and resolvable
   */
  public isPackageInstalled(packageName: string): boolean {
    if (!packageName) return false;
    if (this.isNodeBuiltin(packageName)) return true;

    // Check package.json dependencies
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkgData.dependencies, ...pkgData.devDependencies };
        if (deps[packageName]) {
          // Check if node_modules directory also exists
          const nodeModulesPath = path.join(process.cwd(), 'node_modules', packageName);
          if (fs.existsSync(nodeModulesPath)) {
            return true;
          }
        }
      }
    } catch {}

    // Check require.resolve
    try {
      nativeRequire.resolve(packageName);
      return true;
    } catch {
      // Fallback check node_modules folder
      const nodeModulesPath = path.join(process.cwd(), 'node_modules', packageName);
      return fs.existsSync(nodeModulesPath);
    }
  }

  /**
   * Normalize raw package name (e.g., 'axios/lib/utils' -> 'axios', '@scope/pkg/foo' -> '@scope/pkg')
   */
  public normalizePackageName(rawName: string): string {
    if (!rawName) return '';
    let name = rawName.trim().replace(/^node:/, '');
    if (name.startsWith('@')) {
      const parts = name.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : name;
    }
    return name.split('/')[0];
  }

  /**
   * Extract all required external npm packages and built-in modules from code text
   */
  public extractDependenciesFromCode(code: string): { requiredPackages: string[]; builtins: string[]; packagesMap: Record<string, string[]> } {
    const requiredPackagesSet = new Set<string>();
    const builtinsSet = new Set<string>();

    if (!code) {
      return { requiredPackages: [], builtins: [], packagesMap: {} };
    }

    // Strip comments to prevent false matches inside comments
    const cleanedCode = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    // 1. Regex for require('pkg') or require("pkg") or require(`pkg`)
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = requireRegex.exec(cleanedCode)) !== null) {
      const rawPkg = match[1];
      if (rawPkg && !rawPkg.startsWith('.') && !rawPkg.startsWith('/')) {
        const norm = this.normalizePackageName(rawPkg);
        if (this.isNodeBuiltin(norm)) {
          builtinsSet.add(norm);
        } else if (norm) {
          requiredPackagesSet.add(norm);
        }
      }
    }

    // 2. Regex for import ... from 'pkg' or import('pkg')
    const importRegex = /(?:import\s+[\s\S]*?\s+from\s+|import\s*\(?)\s*['"`]([^'"`]+)['"`]\s*\)?/g;
    while ((match = importRegex.exec(cleanedCode)) !== null) {
      const rawPkg = match[1];
      if (rawPkg && !rawPkg.startsWith('.') && !rawPkg.startsWith('/')) {
        const norm = this.normalizePackageName(rawPkg);
        if (this.isNodeBuiltin(norm)) {
          builtinsSet.add(norm);
        } else if (norm) {
          requiredPackagesSet.add(norm);
        }
      }
    }

    // 3. Regex for packages: ['pkg1', 'pkg2'] in GoatBot config or packages: "pkg1, pkg2"
    const packagesConfigRegex = /packages\s*:\s*(?:\[([^\]]+)\]|['"`]([^'"`]+)['"`])/g;
    while ((match = packagesConfigRegex.exec(cleanedCode)) !== null) {
      const arrayContent = match[1] || match[2];
      if (arrayContent) {
        const pkgs = arrayContent.split(',').map(s => s.replace(/['"`\s\n\r]/g, '')).filter(Boolean);
        for (const p of pkgs) {
          if (!p.startsWith('.') && !p.startsWith('/')) {
            const norm = this.normalizePackageName(p);
            if (this.isNodeBuiltin(norm)) {
              builtinsSet.add(norm);
            } else if (norm) {
              requiredPackagesSet.add(norm);
            }
          }
        }
      }
    }

    const requiredPackages = Array.from(requiredPackagesSet);
    const builtins = Array.from(builtinsSet);

    return {
      requiredPackages,
      builtins,
      packagesMap: {
        external: requiredPackages,
        builtins
      }
    };
  }

  /**
   * Validate if an npm package exists on npm registry
   */
  public async validateNpmPackage(packageName: string): Promise<PackageValidationResult> {
    const norm = this.normalizePackageName(packageName);
    if (!norm) return { valid: false, error: 'Empty package name' };
    if (this.isNodeBuiltin(norm)) return { valid: true, resolvedName: norm };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `https://registry.npmjs.org/${encodeURIComponent(norm)}`;
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.status === 200) {
        const data = await res.json() as any;
        const latestVer = data['dist-tags']?.latest || Object.keys(data.versions || {}).pop() || 'latest';
        return { valid: true, resolvedName: norm, version: latestVer };
      } else if (res.status === 404) {
        return { valid: false, error: `Package "${norm}" was not found on npm registry (404).` };
      } else {
        // Non-404 status (e.g. rate limit / network issue), assume valid for safety
        return { valid: true, resolvedName: norm };
      }
    } catch (err: any) {
      // Network failure or abort -> assume valid to avoid blocking offline/sandbox installs
      return { valid: true, resolvedName: norm };
    }
  }

  /**
   * Lock wrapper to prevent concurrent npm install processes
   */
  private async acquireLock(): Promise<void> {
    if (!this.isInstalling) {
      this.isInstalling = true;
      return;
    }
    return new Promise(resolve => {
      this.installQueue.push(resolve);
    });
  }

  private releaseLock(): void {
    if (this.installQueue.length > 0) {
      const next = this.installQueue.shift();
      if (next) next();
    } else {
      this.isInstalling = false;
    }
  }

  /**
   * Synchronously install missing packages if needed
   */
  public ensurePackagesInstalledSync(packages: string[]): { installed: string[]; failed: string[] } {
    const installed: string[] = [];
    const failed: string[] = [];

    const missing = packages
      .map(p => this.normalizePackageName(p))
      .filter(p => p && !this.isNodeBuiltin(p) && !this.isPackageInstalled(p) && !this.failedInstallsCache.has(p));

    if (missing.length === 0) {
      return { installed: [], failed: [] };
    }

    try {
      console.log(`[DependencyManager] Sync installing missing packages: ${missing.join(', ')}`);
      execSync(`npm install ${missing.join(' ')} --no-audit --no-fund --save`, {
        cwd: process.cwd(),
        stdio: 'inherit',
        timeout: 120000
      });

      for (const pkg of missing) {
        if (this.isPackageInstalled(pkg)) {
          installed.push(pkg);
        } else {
          failed.push(pkg);
          this.failedInstallsCache.add(pkg);
        }
      }
    } catch (err: any) {
      console.error(`[DependencyManager] Sync installation error:`, err.message);
      for (const pkg of missing) {
        if (!this.isPackageInstalled(pkg)) {
          failed.push(pkg);
          this.failedInstallsCache.add(pkg);
        }
      }
    }

    return { installed, failed };
  }

  /**
   * Asynchronously install missing packages with validation & package.json updates
   */
  public async ensureDependenciesInstalled(packages: string[]): Promise<AutoInstallResult> {
    const result: AutoInstallResult = {
      installed: [],
      failed: [],
      alreadyInstalled: [],
      skippedBuiltins: [],
      invalidPackages: []
    };

    const uniqueNormals = Array.from(new Set(packages.map(p => this.normalizePackageName(p)).filter(Boolean)));

    const missing: string[] = [];

    for (const pkg of uniqueNormals) {
      if (this.isNodeBuiltin(pkg)) {
        result.skippedBuiltins.push(pkg);
      } else if (this.isPackageInstalled(pkg)) {
        result.alreadyInstalled.push(pkg);
      } else if (this.failedInstallsCache.has(pkg)) {
        result.failed.push(pkg);
      } else {
        missing.push(pkg);
      }
    }

    if (missing.length === 0) {
      return result;
    }

    await this.acquireLock();

    try {
      // Validate missing packages against npm registry
      const validToInstall: string[] = [];
      for (const pkg of missing) {
        const val = await this.validateNpmPackage(pkg);
        if (val.valid) {
          validToInstall.push(pkg);
        } else {
          result.invalidPackages.push(pkg);
          this.failedInstallsCache.add(pkg);
          console.warn(`[DependencyManager] Skipping invalid/non-existent package: ${pkg} (${val.error})`);
        }
      }

      if (validToInstall.length > 0) {
        console.log(`[DependencyManager] Auto-installing missing npm packages: ${validToInstall.join(', ')}`);

        await new Promise<void>((resolve) => {
          const cmd = `npm install ${validToInstall.join(' ')} --no-audit --no-fund --save`;
          exec(cmd, { cwd: process.cwd(), timeout: 120000 }, (error, stdout, stderr) => {
            if (error) {
              console.error(`[DependencyManager] npm install failed:`, error.message);
            }
            resolve();
          });
        });

        // Verify installations
        for (const pkg of validToInstall) {
          if (this.isPackageInstalled(pkg)) {
            result.installed.push(pkg);
            console.log(`[DependencyManager] Successfully installed "${pkg}"`);
          } else {
            result.failed.push(pkg);
            this.failedInstallsCache.add(pkg);
            console.error(`[DependencyManager] Failed to verify installation of "${pkg}"`);
          }
        }
      }
    } finally {
      this.releaseLock();
    }

    return result;
  }

  /**
   * Auto-scan code and install any missing dependencies prior to command loading/execution
   */
  public async autoResolveForCode(code: string, fileName: string = 'command.js'): Promise<{ success: boolean; installed: string[]; errors: string[] }> {
    const { requiredPackages } = this.extractDependenciesFromCode(code);
    if (requiredPackages.length === 0) {
      return { success: true, installed: [], errors: [] };
    }

    const installResult = await this.ensureDependenciesInstalled(requiredPackages);
    const errors: string[] = [];

    if (installResult.failed.length > 0) {
      errors.push(`Failed to install packages for ${fileName}: ${installResult.failed.join(', ')}`);
    }
    if (installResult.invalidPackages.length > 0) {
      errors.push(`Invalid/non-existent packages skipped: ${installResult.invalidPackages.join(', ')}`);
    }

    return {
      success: installResult.failed.length === 0,
      installed: installResult.installed,
      errors
    };
  }

  /**
   * Intelligently inspect a ZIP workspace/buffer, scan required packages per command,
   * resolve versions, merge needed dependencies, and generate a audit report.
   */
  public async analyzeAndMergeZipDependencies(
    extractedDirPath: string,
    zipPackageJsonDeps: Record<string, string> = {}
  ): Promise<DependencyAuditReport> {
    const report: DependencyAuditReport = {
      alreadyInstalled: [],
      newlyAdded: [],
      skippedBuiltins: [],
      invalidOrMissingNpm: [],
      commandDependencyMap: {},
      installedVersions: {},
      notes: []
    };

    // 1. Find all JavaScript and TypeScript command files recursively
    const files = this.getFilesRecursively(extractedDirPath).filter(
      f => f.endsWith('.js') || f.endsWith('.ts')
    );

    const neededPackagesSet = new Set<string>();

    for (const file of files) {
      try {
        const relativeName = path.relative(extractedDirPath, file);
        const content = fs.readFileSync(file, 'utf8');
        const { requiredPackages, builtins } = this.extractDependenciesFromCode(content);

        report.commandDependencyMap[relativeName] = requiredPackages;

        builtins.forEach(b => {
          if (!report.skippedBuiltins.includes(b)) {
            report.skippedBuiltins.push(b);
          }
        });

        requiredPackages.forEach(p => neededPackagesSet.add(p));
      } catch (err: any) {
        console.warn(`[DependencyManager] Failed to scan file ${file}:`, err.message);
      }
    }

    // Also check if ZIP's package.json had dependencies that are actually referenced
    Object.keys(zipPackageJsonDeps).forEach(pkg => {
      const norm = this.normalizePackageName(pkg);
      if (neededPackagesSet.has(norm)) {
        neededPackagesSet.add(norm);
      }
    });

    const neededPackages = Array.from(neededPackagesSet);

    // 2. Classify needed packages
    const packagesToInstall: string[] = [];

    for (const pkg of neededPackages) {
      if (this.isNodeBuiltin(pkg)) {
        if (!report.skippedBuiltins.includes(pkg)) report.skippedBuiltins.push(pkg);
      } else if (this.isPackageInstalled(pkg)) {
        report.alreadyInstalled.push(pkg);
        try {
          const installedVer = this.getPkgVersion(pkg);
          if (installedVer) report.installedVersions[pkg] = installedVer;
        } catch {}
      } else {
        packagesToInstall.push(pkg);
      }
    }

    // 3. Install newly required packages
    if (packagesToInstall.length > 0) {
      report.notes.push(`Installing ${packagesToInstall.length} missing packages required by ZIP commands: ${packagesToInstall.join(', ')}`);
      const installRes = await this.ensureDependenciesInstalled(packagesToInstall);

      report.newlyAdded.push(...installRes.installed);
      report.invalidOrMissingNpm.push(...installRes.invalidPackages, ...installRes.failed);

      for (const p of installRes.installed) {
        const ver = this.getPkgVersion(p);
        if (ver) report.installedVersions[p] = ver;
      }
    } else {
      report.notes.push('All dependencies required by imported ZIP commands are already satisfied.');
    }

    return report;
  }

  /**
   * Helper to fetch installed version from node_modules or package.json
   */
  private getPkgVersion(pkgName: string): string {
    try {
      const pkgPath = path.join(process.cwd(), 'node_modules', pkgName, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return data.version || 'installed';
      }
    } catch {}
    return 'installed';
  }

  /**
   * Helper to recursively scan directory
   */
  private getFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.getFilesRecursively(fullPath));
      } else {
        results.push(fullPath);
      }
    });
    return results;
  }
}

export const dependencyManager = DependencyManager.getInstance();
