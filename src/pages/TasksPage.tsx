/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CalendarClock, Plus, ToggleLeft, ToggleRight, Trash2, Play, Loader2, FileCheck2, Info, RefreshCw } from 'lucide-react';
import { ScheduledTask, AuditLogItem } from '../types';
import { api } from '../api/client';

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [audits, setAudits] = useState<AuditLogItem[]>([]);

  // Task creation state
  const [showForm, setShowForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskSchedule, setTaskSchedule] = useState('Every 5 Minutes');
  const [taskAction, setTaskAction] = useState<'procedure' | 'sql'>('sql');
  const [taskActionValue, setTaskActionValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 12000); // Poll status every 12 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    try {
      const list = await api.getTasks();
      setTasks(list);

      const logs = await api.getAuditLogs();
      setAudits(logs);
    } catch (err) {
      console.error('Failed to load scheduler data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || !taskActionValue.trim()) return;

    setSubmitting(true);
    try {
      await api.createTask({
        name: taskName,
        description: taskDesc,
        schedule: taskSchedule,
        action: taskAction,
        actionValue: taskActionValue,
        active: true,
      });

      // Clear form
      setTaskName('');
      setTaskDesc('');
      setTaskActionValue('');
      setShowForm(false);
      loadAllData();
    } catch (err: any) {
      alert(`Error creating task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTask = async (task: ScheduledTask) => {
    try {
      await api.updateTask(task.id, { active: !task.active });
      loadAllData();
    } catch (err: any) {
      alert(`Error updating task status: ${err.message}`);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled background task?')) return;
    try {
      await api.deleteTask(id);
      loadAllData();
    } catch (err: any) {
      alert(`Error deleting task: ${err.message}`);
    }
  };

  const triggerRunNow = async (id: string) => {
    try {
      const res = await api.forceRunTask(id);
      alert(res.message);
      loadAllData();
    } catch (err: any) {
      alert(`Force trigger failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-[#8b949e] text-sm">Synchronizing scheduler timers, reading cron logs, and loading audit trails...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Scheduler Workstation & Audits</h2>
          <p className="text-[#8b949e] text-xs mt-1">
            Automate recurring stored SQL procedures or raw scripts, toggle active states, and monitor database telemetry.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          id="btn_new_task_toggle"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded text-xs flex items-center space-x-1.5 transition-all self-start sm:self-center shadow-xs cursor-pointer border border-blue-500"
        >
          <Plus className="h-4 w-4" />
          <span>New Scheduled Task</span>
        </button>
      </div>

      {/* Task Creation Modal / Dropdown Form */}
      {showForm && (
        <form onSubmit={handleCreateTask} className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-4 max-w-2xl">
          <div className="flex items-center space-x-2 border-b border-[#30363d] pb-3">
            <CalendarClock className="h-5 w-5 text-blue-400" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Register Background Routine</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-400">Task Name</label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-slate-200 rounded px-4 py-2 focus:outline-none focus:border-blue-500 font-mono"
                placeholder="e.g., Weekly Consumption Backup"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-400">Schedule Frequency</label>
              <select
                value={taskSchedule}
                onChange={(e) => setTaskSchedule(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-slate-200 rounded px-4 py-2 focus:outline-none focus:border-blue-500 font-mono font-bold cursor-pointer"
              >
                <option value="Every 1 Minute">Every 1 Minute (Fast Testing)</option>
                <option value="Every 5 Minutes">Every 5 Minutes</option>
                <option value="Every 1 Hour">Every 1 Hour</option>
                <option value="Every 24 Hours">Every 24 Hours</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="font-semibold text-slate-400">Description</label>
              <input
                type="text"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-slate-200 rounded px-4 py-2 focus:outline-none focus:border-blue-500 font-mono"
                placeholder="Briefly describe the operational output of this task..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-400">Action Type</label>
              <div className="flex space-x-3 mt-1 text-slate-300">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="task_action_type"
                    checked={taskAction === 'sql'}
                    onChange={() => setTaskAction('sql')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Raw SQL Command</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="task_action_type"
                    checked={taskAction === 'procedure'}
                    onChange={() => setTaskAction('procedure')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Stored Procedure (EXEC)</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="font-semibold text-slate-400">
                {taskAction === 'sql' ? 'SQL Command Script' : 'Stored Procedure Name'}
              </label>
              {taskAction === 'sql' ? (
                <textarea
                  value={taskActionValue}
                  onChange={(e) => setTaskActionValue(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-blue-400 rounded px-4 py-2.5 font-mono text-[11px] h-20 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., UPDATE KwhLogs SET IntervalKwh = ROUND(IntervalKwh, 2);"
                  required
                />
              ) : (
                <input
                  type="text"
                  value={taskActionValue}
                  onChange={(e) => setTaskActionValue(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-slate-200 rounded px-4 py-2 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                  placeholder="e.g., sp_CalculateDailyAverages"
                  required
                />
              )}
            </div>
          </div>

          <div className="flex space-x-2 justify-end pt-2 text-xs">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-[#30363d] text-[#8b949e] hover:text-slate-200 hover:bg-[#21262d] px-4 py-2 rounded cursor-pointer font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              id="btn_save_new_task"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded flex items-center space-x-1 cursor-pointer transition-all border border-blue-500"
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              <span>Save Scheduled Job</span>
            </button>
          </div>
        </form>
      )}

      {/* Task List Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
          <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">Background Operational Schedules</h3>
          <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded font-semibold">Telemetry: Poll active</span>
        </div>

        <div className="p-6">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">No active background scheduler jobs registered.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {tasks.map((task) => (
                <div key={task.id} className="border border-[#30363d] rounded p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#161b22]/50 transition-all bg-[#0d1117]/40">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2.5">
                      <h4 className="font-bold text-slate-200 text-xs">{task.name}</h4>
                      <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-mono">
                        ⏱️ {task.schedule}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8b949e]">{task.description}</p>
                    <div className="flex items-center space-x-3 font-mono text-[9px] text-slate-500 pt-0.5">
                      <span>Action: {task.action.toUpperCase()}</span>
                      <span className="truncate max-w-96 text-slate-300 font-bold">➔ {task.actionValue}</span>
                    </div>
                  </div>

                  {/* Operational Status Logging */}
                  <div className="flex items-center space-x-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#30363d]">
                    <div className="text-right text-[10px]">
                      <span className="text-[#8b949e] block font-semibold">Last Run Status</span>
                      {task.lastRun ? (
                        <div className="space-y-0.5 mt-0.5">
                          <span className={`inline-block font-bold text-[9px] px-1.5 py-0.2 rounded ${task.lastStatus === 'success' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {task.lastStatus?.toUpperCase()}
                          </span>
                          <span className="text-slate-400 block font-mono">{new Date(task.lastRun).toLocaleTimeString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Never Executed</span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Manual trigger */}
                      <button
                        type="button"
                        onClick={() => triggerRunNow(task.id)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-[#30363d] rounded transition-all cursor-pointer bg-[#0d1117]"
                        title="Force Run Routine Now"
                      >
                        <Play className="h-4 w-4 fill-current text-slate-400 hover:text-blue-400" />
                      </button>

                      {/* Enable toggle */}
                      <button
                        type="button"
                        onClick={() => toggleTask(task)}
                        className="p-1 cursor-pointer"
                        title={task.active ? 'Disable' : 'Enable'}
                      >
                        {task.active ? (
                          <ToggleRight className="h-9 w-9 text-blue-500" />
                        ) : (
                          <ToggleLeft className="h-9 w-9 text-[#8b949e]" />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-[#30363d] rounded transition-all cursor-pointer bg-[#0d1117]"
                        title="Delete Task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Central Database Audit Trail Logs */}
      <div className="bg-[#161b22] border border-[#30363d] rounded shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
          <div className="flex items-center space-x-2">
            <FileCheck2 className="h-4.5 w-4.5 text-[#8b949e]" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">Secure Database Engine Audit Logs</h3>
          </div>
          <button
            type="button"
            onClick={loadAllData}
            className="text-[10px] text-[#c9d1d9] hover:text-slate-200 flex items-center space-x-1 bg-[#0d1117] border border-[#30363d] px-2.5 py-1.5 rounded font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reload Logs</span>
          </button>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto border border-[#30363d] rounded max-h-80 bg-[#0d1117]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#161b22] border-b border-[#30363d] text-[#8b949e] z-10 font-mono">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[10px] uppercase tracking-wider bg-[#161b22]">Timestamp</th>
                  <th className="px-4 py-3 font-semibold text-[10px] uppercase tracking-wider bg-[#161b22]">Executed Transaction SQL</th>
                  <th className="px-4 py-3 font-semibold text-[10px] uppercase tracking-wider bg-[#161b22]">Trigger Mode</th>
                  <th className="px-4 py-3 font-semibold text-[10px] uppercase tracking-wider bg-[#161b22]">Operator</th>
                  <th className="px-4 py-3 font-semibold text-[10px] uppercase tracking-wider bg-[#161b22]">Handshake</th>
                  <th className="px-4 py-3 font-semibold text-[10px] uppercase tracking-wider bg-[#161b22]">Result Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d] text-[#c9d1d9] font-mono text-[10px]">
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 italic">No audit transactions written yet. Run queries or scheduler loops to populate telemetry.</td>
                  </tr>
                ) : (
                  audits.map((log) => (
                    <tr key={log.id} className="hover:bg-[#161b22]/50 bg-[#0d1117]">
                      <td className="px-4 py-2.5 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="px-4 py-2.5 max-w-80 truncate text-blue-400" title={log.query}>{log.query}</td>
                      <td className="px-4 py-2.5">
                        <span className="bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded text-[9px] text-slate-300 font-bold">
                          {log.mode.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{log.user}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block font-bold text-[9px] px-1.5 py-0.2 rounded ${log.status === 'success' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 max-w-60 truncate" title={log.resultSummary}>{log.resultSummary}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
