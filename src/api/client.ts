/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConnectionInfo, SchemaMetadata, DependencyGraph, EmsSummary, ProfileResult, ChatMessage, ApprovalItem, ScheduledTask, AuditLogItem } from '../types';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  // Connection API
  async getConnectionInfo(): Promise<ConnectionInfo> {
    const res = await fetch(`${API_BASE}/database/connection`);
    return handleResponse<ConnectionInfo>(res);
  },

  async connect(config: ConnectionInfo): Promise<{ success: boolean; message: string; config?: ConnectionInfo }> {
    const res = await fetch(`${API_BASE}/database/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return handleResponse<{ success: boolean; message: string; config?: ConnectionInfo }>(res);
  },

  async testConnection(config: ConnectionInfo): Promise<{ success: boolean; message: string; databases?: string[] }> {
    const res = await fetch(`${API_BASE}/database/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return handleResponse<{ success: boolean; message: string; databases?: string[] }>(res);
  },

  async scanNetworkServers(): Promise<{ success: boolean; servers: Array<{ name: string; type: string; desc: string }>; logs: string[] }> {
    const res = await fetch(`${API_BASE}/database/scan`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; servers: Array<{ name: string; type: string; desc: string }>; logs: string[] }>(res);
  },

  // Schema API
  async getSchema(): Promise<SchemaMetadata> {
    const res = await fetch(`${API_BASE}/metadata/schema`);
    return handleResponse<SchemaMetadata>(res);
  },

  async getDependencies(): Promise<DependencyGraph> {
    const res = await fetch(`${API_BASE}/metadata/dependencies`);
    return handleResponse<DependencyGraph>(res);
  },

  // Insights API
  async getEmsSummary(): Promise<EmsSummary> {
    const res = await fetch(`${API_BASE}/insights/ems-summary`);
    return handleResponse<EmsSummary>(res);
  },

  async profileTable(tableName: string): Promise<ProfileResult> {
    const res = await fetch(`${API_BASE}/insights/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableName }),
    });
    return handleResponse<ProfileResult>(res);
  },

  async getSampleData(tableName: string, limit = 50): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const res = await fetch(`${API_BASE}/insights/sample/${tableName}?limit=${limit}`);
    return handleResponse<{ success: boolean; data?: any[]; error?: string }>(res);
  },

  // Copilot API
  async askCopilot(request: string): Promise<{ sql: string; explanation: string; affectedObjects: string[]; estimatedImpact: string; isDdl: boolean }> {
    const res = await fetch(`${API_BASE}/sql-copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request }),
    });
    return handleResponse<{ sql: string; explanation: string; affectedObjects: string[]; estimatedImpact: string; isDdl: boolean }>(res);
  },

  // Approvals API
  async getApprovals(): Promise<ApprovalItem[]> {
    const res = await fetch(`${API_BASE}/approvals`);
    return handleResponse<ApprovalItem[]>(res);
  },

  async createApproval(item: Omit<ApprovalItem, 'id' | 'status' | 'timestamp'>): Promise<ApprovalItem> {
    const res = await fetch(`${API_BASE}/approvals/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse<ApprovalItem>(res);
  },

  async submitApprovalAction(id: string, action: 'approve' | 'reject'): Promise<ApprovalItem> {
    const res = await fetch(`${API_BASE}/approvals/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    return handleResponse<ApprovalItem>(res);
  },

  async executeApproval(id: string, confirmCode?: string): Promise<{ success: boolean; result?: string; error?: string; destructiveRequired?: boolean; expectedCode?: string }> {
    const res = await fetch(`${API_BASE}/approvals/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, confirmCode }),
    });
    return handleResponse<{ success: boolean; result?: string; error?: string; destructiveRequired?: boolean; expectedCode?: string }>(res);
  },

  // Task Scheduler API
  async getTasks(): Promise<ScheduledTask[]> {
    const res = await fetch(`${API_BASE}/tasks`);
    return handleResponse<ScheduledTask[]>(res);
  },

  async createTask(task: Omit<ScheduledTask, 'id'>): Promise<ScheduledTask> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    return handleResponse<ScheduledTask>(res);
  },

  async updateTask(id: string, updates: Partial<ScheduledTask>): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async deleteTask(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async forceRunTask(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/tasks/run/${id}`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Audit Logs API
  async getAuditLogs(): Promise<AuditLogItem[]> {
    const res = await fetch(`${API_BASE}/audit`);
    return handleResponse<AuditLogItem[]>(res);
  },

  // Custom Business Context API
  async getDbContexts(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/database/contexts`);
    return handleResponse<any[]>(res);
  },

  async saveDbContext(context: any): Promise<any> {
    const res = await fetch(`${API_BASE}/database/contexts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    });
    return handleResponse<any>(res);
  },

  async deleteDbContext(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/database/contexts/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Custom Dictionary API
  async getDictionaryEntries(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/database/dictionary`);
    return handleResponse<any[]>(res);
  },

  async saveDictionaryEntry(entry: any): Promise<any> {
    const res = await fetch(`${API_BASE}/database/dictionary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return handleResponse<any>(res);
  },

  async deleteDictionaryEntry(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/database/dictionary/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Query Analysis & Dependency Auditor API
  async analyzeQuery(sqlText: string): Promise<{ analysis: any; warnings: any[] }> {
    const res = await fetch(`${API_BASE}/sql-copilot/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlText }),
    });
    return handleResponse<{ analysis: any; warnings: any[] }>(res);
  }
};
