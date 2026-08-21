import fs from 'fs';
import path from 'path';

export interface CookieValidationResult {
  valid: boolean;
  error?: string;
  cookiesCount?: number;
  userId?: string;
  updatedAt?: string;
}

export class CookieLoader {
  private static COOKIE_FILE_NAME = 'appstate_cookie.json';

  /**
   * Get absolute path to the session cookie file at project root
   */
  public static getCookieFilePath(): string {
    return path.join(process.cwd(), this.COOKIE_FILE_NAME);
  }

  /**
   * Check if appstate_cookie.json exists at root
   */
  public static exists(): boolean {
    try {
      return fs.existsSync(this.getCookieFilePath());
    } catch {
      return false;
    }
  }

  /**
   * Validates raw JSON content without exposing any cookie secret values
   */
  public static validateCookieJson(rawJson: string): CookieValidationResult {
    if (!rawJson || typeof rawJson !== 'string' || !rawJson.trim()) {
      return {
        valid: false,
        error: 'Messenger session file is empty or missing.'
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      return {
        valid: false,
        error: 'Invalid Messenger session file. Please export a fresh cookie JSON and replace appstate_cookie.json.'
      };
    }

    if (!Array.isArray(parsed) && typeof parsed !== 'object') {
      return {
        valid: false,
        error: 'Invalid Messenger session format. Cookie export must be a JSON array of cookie objects.'
      };
    }

    const cookieArray = Array.isArray(parsed) ? parsed : Object.values(parsed);

    if (cookieArray.length === 0) {
      return {
        valid: false,
        error: 'Messenger session cookie array is empty.'
      };
    }

    // Inspect cookie fields safely without reading sensitive values
    let cUser: string | undefined;
    let hasEssentialKeys = false;

    for (const cookie of cookieArray) {
      if (cookie && typeof cookie === 'object') {
        const key = cookie.key || cookie.name;
        if (key === 'c_user') {
          cUser = String(cookie.value || '');
          hasEssentialKeys = true;
        }
        if (key === 'xs') {
          hasEssentialKeys = true;
        }
      }
    }

    if (!hasEssentialKeys) {
      return {
        valid: false,
        error: 'Invalid session structure. Essential Facebook authentication keys (c_user/xs) are missing.'
      };
    }

    const cleanedUserId = cUser ? cUser.replace(/[^0-9]/g, '') : undefined;

    return {
      valid: true,
      cookiesCount: cookieArray.length,
      userId: cleanedUserId,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Safely load appstate_cookie.json from project root
   */
  public static loadSafeCookieFile(): { parsedCookies: any[] | null; validation: CookieValidationResult } {
    const filePath = this.getCookieFilePath();

    if (!fs.existsSync(filePath)) {
      return {
        parsedCookies: null,
        validation: {
          valid: false,
          error: 'Messenger session file not found. Add appstate_cookie.json to the project root.'
        }
      };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const validation = this.validateCookieJson(raw);

      if (!validation.valid) {
        return { parsedCookies: null, validation };
      }

      const parsed = JSON.parse(raw);
      const cookieArray = Array.isArray(parsed) ? parsed : Object.values(parsed);
      return { parsedCookies: cookieArray, validation };
    } catch (err: any) {
      return {
        parsedCookies: null,
        validation: {
          valid: false,
          error: 'Messenger session file read error. Ensure proper file permissions.'
        }
      };
    }
  }

  /**
   * Safely write a new session cookie JSON file after thorough server-side validation
   */
  public static saveCookieFileSafely(rawJson: string): CookieValidationResult {
    const validation = this.validateCookieJson(rawJson);
    if (!validation.valid) {
      return validation;
    }

    try {
      const filePath = this.getCookieFilePath();
      
      // Create backup if previous file exists
      if (fs.existsSync(filePath)) {
        const backupPath = path.join(process.cwd(), 'backup_appstate_cookie.json');
        fs.copyFileSync(filePath, backupPath);
      }

      fs.writeFileSync(filePath, rawJson, { encoding: 'utf-8', mode: 0o600 });
      return {
        valid: true,
        cookiesCount: validation.cookiesCount,
        userId: validation.userId,
        updatedAt: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Failed to write session file: ${err.message}`
      };
    }
  }

  /**
   * Delete session cookie file
   */
  public static deleteCookieFile(): boolean {
    try {
      const filePath = this.getCookieFilePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }
}
