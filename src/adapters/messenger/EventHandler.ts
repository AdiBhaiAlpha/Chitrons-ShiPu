export interface GroupEventData {
  type: 'member_join' | 'member_leave' | 'change_thread_name' | 'change_prefix';
  threadID: string;
  authorID: string;
  targetUserID?: string;
  newName?: string;
  newPrefix?: string;
  timestamp: number;
}

export class EventHandler {
  private static listeners: ((event: GroupEventData) => void)[] = [];

  public static onGroupEvent(callback: (event: GroupEventData) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public static emitGroupEvent(event: GroupEventData): void {
    this.listeners.forEach(l => l(event));
  }
}
