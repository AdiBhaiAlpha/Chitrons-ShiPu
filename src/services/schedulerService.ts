import { ScheduledTask } from '../types/shipu';

export class SchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();

  constructor() {
    this.seedDefaultTasks();
  }

  private seedDefaultTasks() {
    const defaultTasks: ScheduledTask[] = [
      {
        id: 'task_daily_reset',
        name: 'Daily Economy Cooldown Reset',
        cronExpression: '0 0 * * *',
        lastRun: new Date(Date.now() - 3600000 * 12).toLocaleString(),
        nextRun: new Date(Date.now() + 3600000 * 12).toLocaleString(),
        status: 'active'
      },
      {
        id: 'task_log_cleanup',
        name: 'System Logs Pruning (Max 500 Records)',
        cronExpression: '0 */6 * * *',
        lastRun: new Date(Date.now() - 3600000 * 2).toLocaleString(),
        nextRun: new Date(Date.now() + 3600000 * 4).toLocaleString(),
        status: 'active'
      },
      {
        id: 'task_auto_backup',
        name: 'Database State Snapshot Backup',
        cronExpression: '0 2 * * *',
        lastRun: new Date(Date.now() - 3600000 * 20).toLocaleString(),
        nextRun: new Date(Date.now() + 3600000 * 4).toLocaleString(),
        status: 'active'
      }
    ];

    defaultTasks.forEach(t => this.tasks.set(t.id, t));
  }

  public getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  public toggleTask(taskId: string): ScheduledTask | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = task.status === 'active' ? 'paused' : 'active';
      this.tasks.set(taskId, task);
    }
    return task;
  }

  public runTaskNow(taskId: string): ScheduledTask | undefined {
    const task = this.tasks.get(taskId);
    if (task) {
      task.lastRun = new Date().toLocaleString();
      this.tasks.set(taskId, task);
    }
    return task;
  }
}

export const schedulerService = new SchedulerService();
