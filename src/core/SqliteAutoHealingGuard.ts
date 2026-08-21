import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

export class SqliteAutoHealingGuardService {
  private static instance: SqliteAutoHealingGuardService;

  public static getInstance(): SqliteAutoHealingGuardService {
    if (!SqliteAutoHealingGuardService.instance) {
      SqliteAutoHealingGuardService.instance = new SqliteAutoHealingGuardService();
    }
    return SqliteAutoHealingGuardService.instance;
  }

  /**
   * Scans and verifies SQLite databases (e.g. Fca_Database/database.sqlite).
   * Automatically heals corrupt databases by purging malformed files before Sequelize or FCA tries to access them.
   */
  public async ensureCleanSqliteDatabases(): Promise<void> {
    const targets = [
      path.join(process.cwd(), 'Fca_Database', 'database.sqlite'),
      path.join(process.cwd(), 'Fca_Database', 'fca_database.sqlite'),
      path.join(process.cwd(), 'database.sqlite')
    ];

    for (const targetPath of targets) {
      if (!fs.existsSync(targetPath)) {
        continue;
      }

      const isHealthy = await this.verifySqliteHealth(targetPath);
      if (!isHealthy) {
        console.warn(`[SQLITE GUARD] ⚠️ Corrupted SQLite database detected at ${targetPath}. Initiating auto-healing...`);
        this.healCorruptDatabase(targetPath);
      } else {
        console.log(`[SQLITE GUARD] ✅ SQLite database at ${targetPath} is healthy and valid.`);
      }
    }
  }

  private verifySqliteHealth(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Basic size check: empty or non-zero files must pass sqlite3 test
      try {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          // 0-byte file will cause sqlite header error on load, treat as invalid
          return resolve(false);
        }
      } catch {
        return resolve(false);
      }

      const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          return resolve(false);
        }

        db.get('PRAGMA quick_check;', (pragmaErr, row: any) => {
          db.close();
          if (pragmaErr) {
            return resolve(false);
          }
          if (row && row.quick_check && row.quick_check !== 'ok') {
            return resolve(false);
          }
          resolve(true);
        });
      });
    });
  }

  private healCorruptDatabase(filePath: string): void {
    try {
      const backupPath = `${filePath}.corrupt.${Date.now()}`;
      fs.renameSync(filePath, backupPath);
      console.log(`[SQLITE GUARD] Corrupt database file backed up to: ${backupPath}`);
    } catch (err) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[SQLITE GUARD] Removed corrupt database file: ${filePath}`);
      } catch (unlinkErr) {
        console.error(`[SQLITE GUARD] Failed to remove corrupt database file:`, unlinkErr);
      }
    }

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export const sqliteAutoHealingGuard = SqliteAutoHealingGuardService.getInstance();
