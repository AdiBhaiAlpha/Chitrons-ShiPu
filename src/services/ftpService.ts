import {
  ftpStorageService,
  FtpConnectionOptions,
  FtpFileItem
} from './ftpStorageService';

export type { FtpConnectionOptions, FtpFileItem };

export async function testFtpConnection(options: FtpConnectionOptions) {
  return ftpStorageService.testConnection(options);
}

export async function listFtpFiles(options: FtpConnectionOptions, subPath: string = '') {
  return ftpStorageService.listDirectory(options, subPath);
}

export async function readFtpFileContent(options: FtpConnectionOptions, filePath: string) {
  return ftpStorageService.readFtpFileContent(options, filePath);
}

export async function writeFtpFileContent(options: FtpConnectionOptions, filePath: string, content: string) {
  return ftpStorageService.writeFtpFileContent(options, filePath, content);
}

export async function deleteFtpFile(options: FtpConnectionOptions, filePath: string) {
  const res = await ftpStorageService.deleteFtpItems(options, [filePath]);
  return { success: res.success, error: res.errors.join('; ') || undefined };
}
