import fs from 'fs';
import path from 'path';
import { botEngine } from '../core/botEngine';

const ROOT_DIR = process.cwd();
const BACKUP_DIR = path.join(ROOT_DIR, '.command-backups');

const ALLOWED_ROOT_DIRS = ['src', 'apps', 'packages', 'public', 'docs'];
const ALLOWED_TOP_LEVEL_FILES = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'metadata.json',
  'render.yaml',
  'README.md'
];

const PROTECTED_PATTERNS = [
  /\.env.*/i,
  /appstate_cookie\.json/i,
  /.*service-account.*\.json/i,
  /.*\.pem$/i,
  /.*\.key$/i,
  /node_modules/i,
  /\.git/i,
  /dist/i,
  /build/i,
  /\.command-backups/i
];

export interface FileNode {
  name: string;
  path: string; // relative path from ROOT_DIR
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  protected?: boolean;
  children?: FileNode[];
}

export class ProjectFilesService {

  public static isPathInsideSandbox(relativePath: string): boolean {
    if (!relativePath) return false;
    const resolved = path.resolve(ROOT_DIR, relativePath);
    if (!resolved.startsWith(ROOT_DIR)) return false;
    if (relativePath.includes('..')) return false;

    const normalized = path.normalize(relativePath).replace(/\\/g, '/').replace(/^\//, '');
    const segments = normalized.split('/');
    const top = segments[0];

    if (!top) return false;
    if (ALLOWED_ROOT_DIRS.includes(top)) return true;
    if (segments.length === 1 && ALLOWED_TOP_LEVEL_FILES.includes(top)) return true;

    return false;
  }

  public static isProtected(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    for (const pattern of PROTECTED_PATTERNS) {
      if (pattern.test(normalized)) return true;
    }
    return false;
  }

  public static getFileTree(): FileNode[] {
    const tree: FileNode[] = [];

    // 1. Scan allowed root directories
    for (const dir of ALLOWED_ROOT_DIRS) {
      const fullPath = path.join(ROOT_DIR, dir);
      if (fs.existsSync(fullPath)) {
        const node = ProjectFilesService.scanDirectory(dir);
        if (node) tree.push(node);
      }
    }

    // 2. Scan allowed top level files
    for (const file of ALLOWED_TOP_LEVEL_FILES) {
      const fullPath = path.join(ROOT_DIR, file);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        tree.push({
          name: file,
          path: file,
          type: 'file',
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
          protected: ProjectFilesService.isProtected(file)
        });
      }
    }

    return tree;
  }

  private static scanDirectory(relativeDirPath: string): FileNode | null {
    const fullPath = path.join(ROOT_DIR, relativeDirPath);
    if (!fs.existsSync(fullPath)) return null;

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) return null;

    const dirName = path.basename(relativeDirPath);
    const children: FileNode[] = [];

    try {
      const items = fs.readdirSync(fullPath);
      for (const item of items) {
        if (item === 'node_modules' || item === '.git' || item === 'dist') continue;

        const childRelPath = path.join(relativeDirPath, item).replace(/\\/g, '/');
        const childFullPath = path.join(ROOT_DIR, childRelPath);
        const childStats = fs.statSync(childFullPath);

        if (childStats.isDirectory()) {
          const sub = ProjectFilesService.scanDirectory(childRelPath);
          if (sub) children.push(sub);
        } else {
          children.push({
            name: item,
            path: childRelPath,
            type: 'file',
            size: childStats.size,
            updatedAt: childStats.mtime.toISOString(),
            protected: ProjectFilesService.isProtected(childRelPath)
          });
        }
      }
    } catch (err) {
      console.error(`Error scanning dir ${relativeDirPath}:`, err);
    }

    // Sort: directories first, then files alphabetically
    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      name: dirName,
      path: relativeDirPath.replace(/\\/g, '/'),
      type: 'directory',
      updatedAt: stats.mtime.toISOString(),
      children
    };
  }

  public static readFile(relativePath: string): { content: string; stats: any } {
    if (!ProjectFilesService.isPathInsideSandbox(relativePath)) {
      throw new Error('Access Denied. Path is outside allowed project root.');
    }

    if (ProjectFilesService.isProtected(relativePath)) {
      throw new Error('SECURITY POLICY: This file is protected and cannot be viewed.');
    }

    const fullPath = path.join(ROOT_DIR, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const stats = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { content, stats };
  }

  public static saveFile(relativePath: string, content: string): { success: boolean; message: string; reloaded?: boolean } {
    if (!ProjectFilesService.isPathInsideSandbox(relativePath)) {
      throw new Error('Access Denied. Cannot save outside allowed project sandbox.');
    }

    if (ProjectFilesService.isProtected(relativePath)) {
      throw new Error('SECURITY POLICY: Writing to protected file is strictly forbidden.');
    }

    const fullPath = path.join(ROOT_DIR, relativePath);

    // 1. Create backup if existing
    if (fs.existsSync(fullPath)) {
      ProjectFilesService.createBackup(relativePath, fs.readFileSync(fullPath, 'utf-8'));
    }

    // 2. Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 3. Write file
    fs.writeFileSync(fullPath, content, 'utf-8');

    // 4. Hot reload if command file
    let reloaded = false;
    if (relativePath.includes('commands') || relativePath.includes('cmds') || relativePath.includes('plugins')) {
      botEngine.reloadPluginsFromDatabase().catch(err => {
        console.error('Error auto-reloading plugins after file save:', err);
      });
      reloaded = true;
    }

    return {
      success: true,
      message: `File "${relativePath}" saved successfully.`,
      reloaded
    };
  }

  public static createNewFile(relativePath: string, templateType: string = 'command'): { success: boolean; message: string } {
    if (!ProjectFilesService.isPathInsideSandbox(relativePath)) {
      throw new Error('Access Denied. Invalid creation path.');
    }

    if (ProjectFilesService.isProtected(relativePath)) {
      throw new Error('Cannot create file with protected name.');
    }

    const fullPath = path.join(ROOT_DIR, relativePath);
    if (fs.existsSync(fullPath)) {
      throw new Error(`File already exists at "${relativePath}"`);
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = path.basename(relativePath, path.extname(relativePath));

    let initialCode = '';
    if (templateType === 'command' || relativePath.endsWith('.ts') || relativePath.endsWith('.js')) {
      initialCode = `import { ShiPuCommandContext } from '../../types/shipu';

export default {
  config: {
    name: "${fileName.toLowerCase()}",
    aliases: [],
    version: "1.0.0",
    author: "ShiPu Ai Owner",
    role: 0,
    category: "Custom",
    description: "Custom ${fileName} command file",
    guide: "{pref}${fileName.toLowerCase()}",
    countDown: 2,
    enabled: true
  },

  async onStart({ message, args, currentUser }: ShiPuCommandContext) {
    const input = args.join(' ') || 'No args provided';
    await message.reply(\`🚀 \${currentUser.name} executed ${fileName}!\\nInput: \${input}\`);
  }
};
`;
    } else if (relativePath.endsWith('.json')) {
      initialCode = `{\n  "name": "${fileName}",\n  "version": "1.0.0"\n}\n`;
    } else {
      initialCode = `// File: ${relativePath}\n`;
    }

    fs.writeFileSync(fullPath, initialCode, 'utf-8');
    return { success: true, message: `Created new file "${relativePath}"` };
  }

  public static createDirectory(relativeDirPath: string): { success: boolean; message: string } {
    if (!ProjectFilesService.isPathInsideSandbox(relativeDirPath)) {
      throw new Error('Access Denied. Invalid folder path.');
    }

    const fullPath = path.join(ROOT_DIR, relativeDirPath);
    if (fs.existsSync(fullPath)) {
      throw new Error('Folder already exists.');
    }

    fs.mkdirSync(fullPath, { recursive: true });
    return { success: true, message: `Created folder "${relativeDirPath}"` };
  }

  public static deletePath(relativePath: string): { success: boolean; message: string } {
    if (!ProjectFilesService.isPathInsideSandbox(relativePath)) {
      throw new Error('Access Denied. Cannot delete outside sandbox.');
    }

    if (ProjectFilesService.isProtected(relativePath)) {
      throw new Error('SECURITY POLICY: Protected files cannot be deleted.');
    }

    const fullPath = path.join(ROOT_DIR, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File or directory does not exist.');
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    return { success: true, message: `Deleted "${relativePath}" successfully.` };
  }

  public static renamePath(oldRelativePath: string, newRelativePath: string): { success: boolean; message: string } {
    if (!ProjectFilesService.isPathInsideSandbox(oldRelativePath) || !ProjectFilesService.isPathInsideSandbox(newRelativePath)) {
      throw new Error('Access Denied. Path out of sandbox bounds.');
    }

    if (ProjectFilesService.isProtected(oldRelativePath) || ProjectFilesService.isProtected(newRelativePath)) {
      throw new Error('SECURITY POLICY: Cannot rename protected items.');
    }

    const oldFullPath = path.join(ROOT_DIR, oldRelativePath);
    const newFullPath = path.join(ROOT_DIR, newRelativePath);

    if (!fs.existsSync(oldFullPath)) throw new Error('Source file does not exist.');
    if (fs.existsSync(newFullPath)) throw new Error('Target destination path already exists.');

    const newDir = path.dirname(newFullPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

    fs.renameSync(oldFullPath, newFullPath);
    return { success: true, message: `Renamed "${oldRelativePath}" to "${newRelativePath}"` };
  }

  public static duplicateFile(sourceRelativePath: string, targetRelativePath: string): { success: boolean; message: string } {
    if (!ProjectFilesService.isPathInsideSandbox(sourceRelativePath) || !ProjectFilesService.isPathInsideSandbox(targetRelativePath)) {
      throw new Error('Access Denied.');
    }

    if (ProjectFilesService.isProtected(sourceRelativePath)) {
      throw new Error('SECURITY POLICY: Cannot duplicate protected file.');
    }

    const sourceFullPath = path.join(ROOT_DIR, sourceRelativePath);
    const targetFullPath = path.join(ROOT_DIR, targetRelativePath);

    if (!fs.existsSync(sourceFullPath)) throw new Error('Source file not found.');
    if (fs.existsSync(targetFullPath)) throw new Error('Target file already exists.');

    fs.copyFileSync(sourceFullPath, targetFullPath);
    return { success: true, message: `Duplicated to "${targetRelativePath}"` };
  }

  public static searchCode(query: string): { path: string; lineNumber: number; lineContent: string }[] {
    if (!query || query.length < 2) return [];

    const results: { path: string; lineNumber: number; lineContent: string }[] = [];
    const searchInNode = (node: FileNode) => {
      if (node.type === 'directory' && node.children) {
        for (const child of node.children) searchInNode(child);
      } else if (node.type === 'file' && !node.protected) {
        try {
          const fullPath = path.join(ROOT_DIR, node.path);
          const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
          lines.forEach((line, idx) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                path: node.path,
                lineNumber: idx + 1,
                lineContent: line.trim()
              });
            }
          });
        } catch (err) {
          // ignore binary / unreadable files
        }
      }
    };

    const tree = ProjectFilesService.getFileTree();
    tree.forEach(searchInNode);

    return results.slice(0, 100); // return top 100 results
  }

  // --- BACKUP & RESTORE SYSTEM ---
  private static createBackup(relativePath: string, content: string) {
    try {
      const cleanName = path.basename(relativePath, path.extname(relativePath));
      const fileBackupDir = path.join(BACKUP_DIR, cleanName);

      if (!fs.existsSync(fileBackupDir)) {
        fs.mkdirSync(fileBackupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(fileBackupDir, `${timestamp}.backup`);

      fs.writeFileSync(backupPath, content, 'utf-8');

      // Keep only max 10 latest backups
      const files = fs.readdirSync(fileBackupDir);
      if (files.length > 10) {
        files.sort();
        const toDelete = files.slice(0, files.length - 10);
        for (const oldFile of toDelete) {
          fs.unlinkSync(path.join(fileBackupDir, oldFile));
        }
      }
    } catch (err) {
      console.error('Failed to create file backup:', err);
    }
  }

  public static listBackups(relativePath: string): { filename: string; timestamp: string; size: number }[] {
    const cleanName = path.basename(relativePath, path.extname(relativePath));
    const fileBackupDir = path.join(BACKUP_DIR, cleanName);

    if (!fs.existsSync(fileBackupDir)) return [];

    const files = fs.readdirSync(fileBackupDir);
    return files.map(f => {
      const p = path.join(fileBackupDir, f);
      const stats = fs.statSync(p);
      return {
        filename: f,
        timestamp: f.replace('.backup', ''),
        size: stats.size
      };
    }).sort((a, b) => b.filename.localeCompare(a.filename));
  }

  public static restoreBackup(relativePath: string, backupFilename: string): { success: boolean; message: string } {
    const cleanName = path.basename(relativePath, path.extname(relativePath));
    const backupPath = path.join(BACKUP_DIR, cleanName, backupFilename);

    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found.');
    }

    const content = fs.readFileSync(backupPath, 'utf-8');
    return ProjectFilesService.saveFile(relativePath, content);
  }
}
