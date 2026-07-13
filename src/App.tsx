/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ConnectDatabasePage from './pages/ConnectDatabasePage';
import SchemaExplorerPage from './pages/SchemaExplorerPage';
import InsightsPage from './pages/InsightsPage';
import SqlCopilotPage from './pages/SqlCopilotPage';
import ApprovalPage from './pages/ApprovalPage';
import TasksPage from './pages/TasksPage';
import { ConnectionInfo, ChatMessage } from './types';
import { api } from './api/client';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('connect');
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  
  // Lifted Chat history to prevent losing state when switching windows
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_00',
      role: 'assistant',
      content: `Hello! I am your AI Database Engineer Copilot.
I can decode, understand, and analyze any database structure, dependencies, and historical logs (including BMS, CMS, Water Management, Electrical Power Historians, or custom relational models) and extract actionable system-wide insights for you.

Here are some suggested prompts you can run to test me:
- **"Show BMS environmental logs highlighting zone CO₂ spikes"**
- **"Join CMS equipment with maintenance costs to locate high repair budgets"**
- **"Analyze Water flow rates and total volumes consumed per pipe sensor"**
- **"Calculate phase current imbalances from the high-frequency Electrical Historian logs"**`,
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  // Lifted editor SQL and query results to persist between window changes
  const [persistedSql, setPersistedSql] = useState('');
  const [persistedResult, setPersistedResult] = useState<any | null>(null);
  const [copilotPrompt, setCopilotPrompt] = useState('');

  // Unsaved changes state for navigation warning
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  useEffect(() => {
    // Poll the active connection status from the backend
    api.getConnectionInfo()
      .then((info) => {
        if (info && (info.databaseName || info.isDemo)) {
          setConnectionInfo(info);
          // If already connected, default tab to SQL Copilot
          setActiveTab('copilot');
        }
      })
      .catch((err) => console.error('Failed to parse database connection:', err));
  }, []);

  const handleConnected = (info: ConnectionInfo) => {
    setConnectionInfo(info);
    setHasUnsavedChanges(false);
    setActiveTab('copilot'); // Shift immediately to Copilot on successful database mount
  };

  const handleAppliedOnly = (info: ConnectionInfo) => {
    setConnectionInfo(info);
    setHasUnsavedChanges(false);
    // Stays on ConnectDatabasePage, does not throw user to Copilot
  };

  const handleTabChange = (tab: string) => {
    if (activeTab === 'connect' && hasUnsavedChanges) {
      setPendingTab(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'connect':
        return (
          <ConnectDatabasePage
            onConnected={handleConnected}
            onApplied={handleAppliedOnly}
            connectionInfo={connectionInfo}
            setHasUnsavedChanges={setHasUnsavedChanges}
          />
        );
      case 'schema':
        return <SchemaExplorerPage />;
      case 'insights':
        return <InsightsPage />;
      case 'copilot':
        return (
          <SqlCopilotPage
            messages={messages}
            setMessages={setMessages}
            persistedSql={persistedSql}
            setPersistedSql={setPersistedSql}
            persistedResult={persistedResult}
            setPersistedResult={setPersistedResult}
            prompt={copilotPrompt}
            setPrompt={setCopilotPrompt}
          />
        );
      case 'approvals':
        return <ApprovalPage />;
      case 'tasks':
        return <TasksPage />;
      default:
        return (
          <ConnectDatabasePage
            onConnected={handleConnected}
            onApplied={handleAppliedOnly}
            connectionInfo={connectionInfo}
            setHasUnsavedChanges={setHasUnsavedChanges}
          />
        );
    }
  };

  return (
    <div className="relative min-h-screen">
      <Layout
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        connectionInfo={connectionInfo}
      >
        {renderActivePage()}
      </Layout>

      {/* Modern, high-contrast modal prompt for unsaved changes */}
      {pendingTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3.5 text-amber-500">
              <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <h3 className="font-bold text-slate-100 uppercase tracking-wide text-sm font-mono">⚠️ Unsaved Connection Edits</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  You have modified your database connection credentials or host parameters without applying or saving them.
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Navigating to another section now will discard these edits.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingTab(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-bold rounded uppercase tracking-wider transition-colors cursor-pointer"
              >
                Stay & Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setActiveTab(pendingTab);
                  setPendingTab(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-[11px] text-white font-bold rounded uppercase tracking-wider transition-colors cursor-pointer"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
