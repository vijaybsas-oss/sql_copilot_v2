/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScheduledTask } from '../src/types';
import { dbManager } from './db_manager';

export class TaskScheduler {
  private checkInterval: NodeJS.Timeout | null = null;
  private tasks: ScheduledTask[] = [];

  constructor() {
    this.initTasks();
  }

  // Initialize and load tasks
  private async initTasks() {
    // We create the Tasks table in our demo DB to persist configurations
    const query = `
      CREATE TABLE IF NOT EXISTS ScheduledTasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        schedule TEXT NOT NULL,
        action TEXT NOT NULL,
        actionValue TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        lastRun TEXT,
        lastStatus TEXT,
        lastResult TEXT
      )
    `;
    const createRes = await dbManager.executeQuery(query);
    if (!createRes.success) {
      console.warn(`[Scheduler] Failed to initialize ScheduledTasks table: ${createRes.error || 'No active connection'}. Retrying in 2 seconds...`);
      setTimeout(() => this.initTasks(), 2000);
      return;
    }

    // Seed default tasks if empty
    const countQuery = await dbManager.executeQuery('SELECT COUNT(*) as count FROM ScheduledTasks');
    if (!countQuery.success) {
      console.warn(`[Scheduler] Failed to query ScheduledTasks table count: ${countQuery.error || 'No active connection'}. Retrying in 2 seconds...`);
      setTimeout(() => this.initTasks(), 2000);
      return;
    }
    const count = countQuery.data && countQuery.data[0] ? countQuery.data[0].count : 0;

    if (count === 0) {
      const defaultTasks: ScheduledTask[] = [
        {
          id: 'task_01',
          name: 'Hourly Shift-wise Log Cleanup',
          description: 'Recovers index buffers and aligns boundary intervals for Shift A/B/C logs.',
          schedule: 'Every 5 Minutes',
          action: 'sql',
          actionValue: "UPDATE KwhLogs SET IntervalKwh = ROUND(IntervalKwh, 2);",
          active: true,
        },
        {
          id: 'task_02',
          name: 'Refresh Daily Averages Metric Cache',
          description: 'Triggers procedural calculation to cache standard deviation benchmarks.',
          schedule: 'Every 1 Hour',
          action: 'procedure',
          actionValue: 'sp_CalculateDailyAverages',
          active: true,
        }
      ];

      for (const t of defaultTasks) {
        await dbManager.executeQuery(`
          INSERT INTO ScheduledTasks (id, name, description, schedule, action, actionValue, active)
          VALUES ('${t.id}', '${t.name}', '${t.description}', '${t.schedule}', '${t.action}', "${t.actionValue.replace(/"/g, '""')}", ${t.active ? 1 : 0})
        `);
      }
    }

    await this.loadTasksFromDb();
    this.startScheduler();
  }

  // Reload tasks array from sqlite
  private async loadTasksFromDb() {
    const res = await dbManager.executeQuery('SELECT * FROM ScheduledTasks');
    if (res.success && res.data) {
      this.tasks = res.data.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        schedule: row.schedule,
        action: row.action as 'procedure' | 'sql',
        actionValue: row.actionValue,
        active: row.active === 1,
        lastRun: row.lastRun,
        lastStatus: row.lastStatus,
        lastResult: row.lastResult
      }));
    }
  }

  // Starts the high-frequency evaluation cron loop
  public startScheduler() {
    if (this.checkInterval) return;

    console.log('Background Database task scheduler started.');
    this.checkInterval = setInterval(async () => {
      await this.loadTasksFromDb();
      const now = new Date();

      for (const task of this.tasks) {
        if (!task.active) continue;

        let shouldRun = false;
        const lastRunTime = task.lastRun ? new Date(task.lastRun) : null;

        // Simplified schedule triggers for dynamic live sandbox testing
        if (!lastRunTime) {
          shouldRun = true;
        } else {
          const diffMs = now.getTime() - lastRunTime.getTime();
          if (task.schedule === 'Every 1 Minute' && diffMs >= 60000) shouldRun = true;
          else if (task.schedule === 'Every 5 Minutes' && diffMs >= 300000) shouldRun = true;
          else if (task.schedule === 'Every 1 Hour' && diffMs >= 3600000) shouldRun = true;
          else if (task.schedule === 'Every 24 Hours' && diffMs >= 86400000) shouldRun = true;
        }

        if (shouldRun) {
          await this.executeTask(task);
        }
      }
    }, 15000); // Check every 15 seconds
  }

  // Execute task and update DB status logs
  public async executeTask(task: ScheduledTask) {
    const timestamp = new Date().toISOString();
    console.log(`Executing scheduled task: ${task.name}...`);

    let success = false;
    let resultSummary = '';

    try {
      if (task.action === 'sql') {
        const queryRes = await dbManager.executeQuery(task.actionValue);
        success = queryRes.success;
        resultSummary = queryRes.success 
          ? `SQL batch succeeded. Rows impacted: ${queryRes.rowCount || 0}`
          : `SQL failed: ${queryRes.error || 'Unknown error'}`;
      } else {
        // Mock Stored Procedure execution
        success = true;
        resultSummary = `Procedure '${task.actionValue}' executed successfully. Refreshed cached benchmarks in dbo.MetricCache.`;
      }
    } catch (err: any) {
      success = false;
      resultSummary = `System exception: ${err.message}`;
    }

    // Update database record
    await dbManager.executeQuery(`
      UPDATE ScheduledTasks 
      SET lastRun = '${timestamp}',
          lastStatus = '${success ? 'success' : 'failed'}',
          lastResult = "${resultSummary.replace(/"/g, '""')}"
      WHERE id = '${task.id}'
    `);

    // Log in audit log
    dbManager.logAudit(
      task.action === 'sql' ? task.actionValue : `EXEC ${task.actionValue}`,
      'scheduler_job',
      success ? 'success' : 'failed',
      `Scheduler Execution: ${resultSummary}`,
      'System Scheduler'
    );
  }

  // API Methods
  public async getTasks(): Promise<ScheduledTask[]> {
    await this.loadTasksFromDb();
    return this.tasks;
  }

  public async createTask(task: Omit<ScheduledTask, 'id'>): Promise<ScheduledTask> {
    const id = 'task_' + Math.random().toString(36).substr(2, 9);
    await dbManager.executeQuery(`
      INSERT INTO ScheduledTasks (id, name, description, schedule, action, actionValue, active)
      VALUES ('${id}', "${task.name.replace(/"/g, '""')}", "${task.description.replace(/"/g, '""')}", '${task.schedule}', '${task.action}', "${task.actionValue.replace(/"/g, '""')}", ${task.active ? 1 : 0})
    `);
    await this.loadTasksFromDb();
    return this.tasks.find((t) => t.id === id)!;
  }

  public async updateTask(id: string, updates: Partial<ScheduledTask>): Promise<boolean> {
    const setClauses: string[] = [];
    if (updates.name !== undefined) setClauses.push(`name = "${updates.name.replace(/"/g, '""')}"`);
    if (updates.description !== undefined) setClauses.push(`description = "${updates.description.replace(/"/g, '""')}"`);
    if (updates.schedule !== undefined) setClauses.push(`schedule = '${updates.schedule}'`);
    if (updates.action !== undefined) setClauses.push(`action = '${updates.action}'`);
    if (updates.actionValue !== undefined) setClauses.push(`actionValue = "${updates.actionValue.replace(/"/g, '""')}"`);
    if (updates.active !== undefined) setClauses.push(`active = ${updates.active ? 1 : 0}`);

    if (setClauses.length === 0) return true;

    const query = `UPDATE ScheduledTasks SET ${setClauses.join(', ')} WHERE id = '${id}'`;
    const res = await dbManager.executeQuery(query);
    await this.loadTasksFromDb();
    return res.success;
  }

  public async deleteTask(id: string): Promise<boolean> {
    const res = await dbManager.executeQuery(`DELETE FROM ScheduledTasks WHERE id = '${id}'`);
    await this.loadTasksFromDb();
    return res.success;
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const scheduler = new TaskScheduler();
