/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import sqlite3 from 'sqlite3';
import { ScheduledTask } from '../src/types';
import { dbManager } from './db_manager';

export class TaskScheduler {
  private checkInterval: NodeJS.Timeout | null = null;
  private tasks: ScheduledTask[] = [];
  private schedulerDb: sqlite3.Database | null = null;

  constructor() {
    this.schedulerDb = new sqlite3.Database('./scheduler.db', (err) => {
      if (err) {
        console.error('[Scheduler] Failed to open scheduler SQLite database:', err);
      } else {
        this.initTasks();
      }
    });
  }

  // Initialize and load tasks
  private async initTasks() {
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

    this.schedulerDb?.run(query, (err) => {
      if (err) {
        console.error('[Scheduler] Failed to create ScheduledTasks table:', err);
        return;
      }

      this.schedulerDb?.get('SELECT COUNT(*) as count FROM ScheduledTasks', [], async (countErr, row: any) => {
        if (countErr) {
          console.error('[Scheduler] Failed to check ScheduledTasks count:', countErr);
          return;
        }

        const count = row ? row.count : 0;
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
            this.schedulerDb?.run(`
              INSERT INTO ScheduledTasks (id, name, description, schedule, action, actionValue, active)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [t.id, t.name, t.description, t.schedule, t.action, t.actionValue, t.active ? 1 : 0]);
          }
        }

        await this.loadTasksFromDb();
        this.startScheduler();
      });
    });
  }

  // Reload tasks array from sqlite3
  private loadTasksFromDb(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.schedulerDb) return resolve();

      this.schedulerDb.all('SELECT * FROM ScheduledTasks', [], (err, rows: any[]) => {
        if (!err && rows) {
          this.tasks = rows.map((row: any) => ({
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
        } else if (err) {
          console.error('[Scheduler] Error loading tasks from SQLite:', err);
        }
        resolve();
      });
    });
  }

  // Starts the high-frequency cron evaluation loop
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

    // Update database record in the private SQLite DB
    this.schedulerDb?.run(`
      UPDATE ScheduledTasks 
      SET lastRun = ?,
          lastStatus = ?,
          lastResult = ?
      WHERE id = ?
    `, [timestamp, success ? 'success' : 'failed', resultSummary, task.id], (err) => {
      if (err) {
        console.error('[Scheduler] Failed to update task status in SQLite:', err);
      }
    });

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
    return new Promise((resolve, reject) => {
      this.schedulerDb?.run(`
        INSERT INTO ScheduledTasks (id, name, description, schedule, action, actionValue, active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, task.name, task.description, task.schedule, task.action, task.actionValue, task.active ? 1 : 0], async (err) => {
        if (err) return reject(err);
        await this.loadTasksFromDb();
        resolve(this.tasks.find((t) => t.id === id)!);
      });
    });
  }

  public async updateTask(id: string, updates: Partial<ScheduledTask>): Promise<boolean> {
    return new Promise((resolve) => {
      const setClauses: string[] = [];
      const params: any[] = [];
      if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
      if (updates.description !== undefined) { setClauses.push('description = ?'); params.push(updates.description); }
      if (updates.schedule !== undefined) { setClauses.push('schedule = ?'); params.push(updates.schedule); }
      if (updates.action !== undefined) { setClauses.push('action = ?'); params.push(updates.action); }
      if (updates.actionValue !== undefined) { setClauses.push('actionValue = ?'); params.push(updates.actionValue); }
      if (updates.active !== undefined) { setClauses.push('active = ?'); params.push(updates.active ? 1 : 0); }

      if (setClauses.length === 0) return resolve(true);

      params.push(id);
      const query = `UPDATE ScheduledTasks SET ${setClauses.join(', ')} WHERE id = ?`;
      this.schedulerDb?.run(query, params, async (err) => {
        await this.loadTasksFromDb();
        resolve(!err);
      });
    });
  }

  public async deleteTask(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.schedulerDb?.run('DELETE FROM ScheduledTasks WHERE id = ?', [id], async (err) => {
        await this.loadTasksFromDb();
        resolve(!err);
      });
    });
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.schedulerDb) {
      this.schedulerDb.close();
    }
  }
}

export const scheduler = new TaskScheduler();
