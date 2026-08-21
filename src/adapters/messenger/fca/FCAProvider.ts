import { FCAAuthErrorDetails } from './FCAAuthErrorClassifier';

export interface FCAConnection {
  providerName: string;
  api: any;
  botUserId: string;
  listen(
    onEvent: (event: any) => void,
    onError: (error: any) => void
  ): Promise<() => void>;
  disconnect(): Promise<void>;
  logout?(): Promise<void>;
}

export interface FCAProvider {
  name: string;
  packageName: string;
  isAvailable(): Promise<boolean>;
  login(appState: any[]): Promise<{ connection?: FCAConnection; error?: FCAAuthErrorDetails }>;
}
