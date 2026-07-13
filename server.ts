/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbManager } from './server/db_manager';
import { copilot } from './server/copilot';
import { scheduler } from './server/scheduler';
import { ApprovalItem } from './src/types';
import { aiSettingsManager, testProviderConnection, fetchProviderModels } from './server/ai_settings';

// Centralised in-memory queue for approval requests to keep it simple and clean
let approvals: ApprovalItem[] = [
  {
    id: 'appr_01',
    sqlText: `CREATE INDEX idx_kwhlogs_timestamp_meter ON KwhLogs(Timestamp, MeterID);`,
    summary: 'Add performance index for interval logging queries',
    affectedObjects: ['KwhLogs'],
    status: 'pending',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON parsing
  app.use(express.json());

  // API - Connection Routes
  app.get('/api/database/connection', (req, res) => {
    res.json(dbManager.getConnectionInfo() || { isDemo: true, dbType: 'sqlite', databaseName: 'EMS Demonstration Sandbox' });
  });

  app.post('/api/database/connect', async (req, res) => {
    const { dbType, host, port, databaseName, username, password, isDemo, authType } = req.body;
    if (isDemo) {
      dbManager.connectDemo();
      return res.json({ 
        success: true, 
        message: 'Connected successfully to EMS Demonstration Sandbox.',
        config: dbManager.getConnectionInfo()
      });
    }
    const result = await dbManager.connectCustom({ dbType, host, port, databaseName, username, password, authType });
    res.json({
      ...result,
      config: dbManager.getConnectionInfo()
    });
  });

  app.post('/api/database/test', async (req, res) => {
    const { dbType, host, port, databaseName, username, password, authType } = req.body;
    try {
      const result = await dbManager.testConnection({ dbType, host, port, databaseName, username, password, authType });
      res.json(result);
    } catch (err: any) {
      res.json({ success: false, message: err.message || 'Connection test failed.' });
    }
  });

  app.post('/api/database/scan', async (req, res) => {
    try {
      const result = await dbManager.scanServers();
      res.json(result);
    } catch (err: any) {
      res.json({ success: false, servers: [], logs: [`Scan failed: ${err.message}`] });
    }
  });

  // API - Schema Explorer Routes
  app.get('/api/metadata/schema', async (req, res) => {
    try {
      const schema = await dbManager.getSchema();
      res.json(schema);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/metadata/dependencies', async (req, res) => {
    try {
      const deps = await dbManager.getDependencies();
      res.json(deps);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Insights and Profiling
  app.get('/api/insights/ems-summary', async (req, res) => {
    try {
      const summary = await dbManager.getEmsSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/insights/profile', async (req, res) => {
    const { tableName } = req.body;
    if (!tableName) return res.status(400).json({ error: 'tableName parameter is required' });
    try {
      const profile = await dbManager.getProfile(tableName);
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/insights/sample/:tableName', async (req, res) => {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
      const isSqlserver = dbManager.getCurrentDbType() === 'sqlserver' || dbManager.getCurrentDbType() === 'mssql';
      const escapedTable = dbManager.getCurrentDbType() === 'sqlite' ? `"${tableName}"`
        : dbManager.getCurrentDbType() === 'mysql' ? `\`${tableName}\``
        : isSqlserver ? `[${tableName}]`
        : `"${tableName}"`;

      let query = '';
      if (isSqlserver) {
        query = `SELECT TOP ${limit} * FROM ${escapedTable}`;
      } else {
        query = `SELECT * FROM ${escapedTable} LIMIT ${limit}`;
      }

      const result = await dbManager.executeQuery(query);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - SQL Copilot Chat API
  app.post('/api/sql-copilot/ask', async (req, res) => {
    const { request } = req.body;
    if (!request) return res.status(400).json({ error: 'request prompt is required' });

    try {
      const schema = await dbManager.getSchema();
      const proposal = await copilot.generateSqlProposal(schema, request);

      // If the generated SQL proposal represents a structural schema change (DDL),
      // we automatically append it to our Approval Center queue so the user has a draft
      if (proposal.isDdl) {
        const newApproval: ApprovalItem = {
          id: 'appr_' + Math.random().toString(36).substr(2, 9),
          sqlText: proposal.sql,
          summary: `AI Suggested: ${request.substring(0, 60)}...`,
          affectedObjects: proposal.affectedObjects,
          status: 'pending',
          timestamp: new Date().toISOString()
        };
        approvals.unshift(newApproval);
      }

      res.json(proposal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Custom Database Business Context
  app.get('/api/database/contexts', (req, res) => {
    res.json(copilot.dbContexts);
  });

  app.post('/api/database/contexts', (req, res) => {
    const { domainName, businessRules, relationships, conventions, id } = req.body;
    if (!domainName) return res.status(400).json({ error: 'domainName is required' });
    
    if (id) {
      const existing = copilot.dbContexts.find(c => c.id === id);
      if (existing) {
        existing.domainName = domainName;
        existing.businessRules = businessRules || '';
        existing.relationships = relationships || '';
        existing.conventions = conventions || '';
        return res.json(existing);
      }
    }
    
    const newCtx = {
      id: 'ctx_' + Math.random().toString(36).substr(2, 9),
      domainName,
      businessRules: businessRules || '',
      relationships: relationships || '',
      conventions: conventions || ''
    };
    copilot.dbContexts.push(newCtx);
    res.json(newCtx);
  });

  app.delete('/api/database/contexts/:id', (req, res) => {
    const { id } = req.params;
    copilot.dbContexts = copilot.dbContexts.filter(c => c.id !== id);
    res.json({ success: true });
  });

  // API - Custom Column Technical Dictionary
  app.get('/api/database/dictionary', (req, res) => {
    res.json(copilot.dictionaryEntries);
  });

  app.post('/api/database/dictionary', (req, res) => {
    const { tableName, columnName, displayName, description, id } = req.body;
    if (!tableName || !columnName || !displayName) {
      return res.status(400).json({ error: 'tableName, columnName, and displayName are required' });
    }

    if (id) {
      const existing = copilot.dictionaryEntries.find(d => d.id === id);
      if (existing) {
        existing.tableName = tableName;
        existing.columnName = columnName;
        existing.displayName = displayName;
        existing.description = description || '';
        return res.json(existing);
      }
    }

    const newDic = {
      id: 'dic_' + Math.random().toString(36).substr(2, 9),
      tableName,
      columnName,
      displayName,
      description: description || ''
    };
    copilot.dictionaryEntries.push(newDic);
    res.json(newDic);
  });

  app.delete('/api/database/dictionary/:id', (req, res) => {
    const { id } = req.params;
    copilot.dictionaryEntries = copilot.dictionaryEntries.filter(d => d.id !== id);
    res.json({ success: true });
  });

  // API - Model Provider Settings & Dynamic Listing
  app.get('/api/ai-settings', (req, res) => {
    res.json(aiSettingsManager.getRedactedSettings());
  });

  app.post('/api/ai-settings', (req, res) => {
    try {
      aiSettingsManager.saveSettings(req.body);
      res.json({ success: true, settings: aiSettingsManager.getRedactedSettings() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ai-settings/test', async (req, res) => {
    const { provider, config } = req.body;
    if (!provider || !config) {
      return res.status(400).json({ error: 'provider and config parameters are required' });
    }
    try {
      const result = await testProviderConnection(provider, config);
      res.json(result);
    } catch (err: any) {
      res.json({ success: false, message: err.message || 'Connection test failed.' });
    }
  });

  app.post('/api/ai-settings/models', async (req, res) => {
    const { provider, config } = req.body;
    if (!provider || !config) {
      return res.status(400).json({ error: 'provider and config parameters are required' });
    }
    try {
      const models = await fetchProviderModels(provider, config);
      res.json({ success: true, models });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Query Analysis & Dependency Auditor
  app.post('/api/sql-copilot/analyze', async (req, res) => {
    const { sqlText } = req.body;
    try {
      const schema = await dbManager.getSchema();
      const analysis = await copilot.analyzeSqlQuery(schema, sqlText);
      const warnings = copilot.auditSqlQuery(schema, sqlText);
      res.json({ analysis, warnings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Approval Center
  app.get('/api/approvals', (req, res) => {
    res.json(approvals);
  });

  app.post('/api/approvals/create', (req, res) => {
    const { sqlText, summary, affectedObjects } = req.body;
    const newApproval: ApprovalItem = {
      id: 'appr_' + Math.random().toString(36).substr(2, 9),
      sqlText,
      summary,
      affectedObjects: affectedObjects || [],
      status: 'pending',
      timestamp: new Date().toISOString()
    };
    approvals.unshift(newApproval);
    res.json(newApproval);
  });

  app.post('/api/approvals/action', (req, res) => {
    const { id, action } = req.body; // action: 'approve' | 'reject'
    const approval = approvals.find((a) => a.id === id);
    if (!approval) return res.status(404).json({ error: 'Approval item not found' });

    approval.status = action === 'approve' ? 'approved' : 'rejected';
    res.json(approval);
  });

  app.post('/api/approvals/execute', async (req, res) => {
    const { id, confirmCode, sqlText, dryRun } = req.body;

    if (id === 'appr_direct_run') {
      try {
        const result = await dbManager.executeQuery(sqlText, 'DB Sandbox', !!dryRun);
        return res.json(result);
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    const approval = approvals.find((a) => a.id === id);
    if (!approval) return res.status(404).json({ error: 'Approval item not found' });
    if (approval.status !== 'approved' && approval.status !== 'pending') {
      return res.status(400).json({ error: 'Item must be approved or pending before execution.' });
    }

    const uppercaseSql = approval.sqlText.toUpperCase();
    const isDestructive = uppercaseSql.includes('DROP TABLE') || (uppercaseSql.includes('DELETE') && !uppercaseSql.includes('WHERE'));

    // Check for required double confirmation if destructive
    if (isDestructive) {
      const match = approval.sqlText.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
      const tableName = match ? match[1] : 'TABLE';
      const expectedCode = `CONFIRM_DROP_TABLE_${tableName.toUpperCase()}`;

      if (confirmCode !== expectedCode) {
        return res.status(400).json({
          destructiveRequired: true,
          expectedCode,
          error: `Destructive command detected! Double-confirmation code is required. Please type: ${expectedCode}`
        });
      }
    }

    try {
      const result = await dbManager.executeQuery(approval.sqlText);
      if (result.success) {
        approval.status = 'executed';
        approval.result = `Success: RowCount/Changes = ${result.rowCount || 0}`;
        res.json({ success: true, result: approval.result });
      } else {
        res.status(400).json({ error: result.error || 'Execution failed' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Task Scheduler Routes
  app.get('/api/tasks', async (req, res) => {
    const tasks = await scheduler.getTasks();
    res.json(tasks);
  });

  app.post('/api/tasks', async (req, res) => {
    const { name, description, schedule: taskSchedule, action, actionValue, active } = req.body;
    try {
      const newTask = await scheduler.createTask({
        name,
        description,
        schedule: taskSchedule,
        action,
        actionValue,
        active: !!active
      });
      res.json(newTask);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const success = await scheduler.updateTask(id, req.body);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const success = await scheduler.deleteTask(id);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tasks/run/:id', async (req, res) => {
    const { id } = req.params;
    const tasks = await scheduler.getTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    try {
      await scheduler.executeTask(task);
      res.json({ success: true, message: `Forced scheduled trigger initiated for ${task.name}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Audit log
  app.get('/api/audit', async (req, res) => {
    try {
      const logs = await dbManager.getAuditLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development server mounted as Express middleware.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static client builds serving from dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express application active and routing on port ${PORT}`);
  });
}

startServer();
