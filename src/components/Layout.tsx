/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Database, Network, LineChart, MessageSquare, ShieldCheck, CalendarClock, Activity } from 'lucide-react';
import { ConnectionInfo } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  connectionInfo: ConnectionInfo | null;
}

export default function Layout({ children, activeTab, setActiveTab, connectionInfo }: LayoutProps) {
  const navItems = [
    { id: 'connect', label: 'Connection', icon: Database },
    { id: 'schema', label: 'Schema Explorer', icon: Network },
    { id: 'insights', label: 'Data Insights', icon: LineChart },
    { id: 'copilot', label: 'SQL Copilot', icon: MessageSquare },
    { id: 'approvals', label: 'Approval Center', icon: ShieldCheck },
    { id: 'tasks', label: 'Scheduler & Audit', icon: CalendarClock },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col font-sans text-[#c9d1d9] antialiased">
      {/* Top Header Bar */}
      <header className="bg-[#161b22] border-b border-[#30363d] sticky top-0 z-50 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-md">
            T
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              TASC SQL COPILOT <span className="text-blue-400 font-mono text-[10px] bg-[#30363d] px-1.5 py-0.5 rounded">v0.8.4-beta</span>
            </h1>
            <p className="text-[10px] font-mono text-[#8b949e] mt-0.5">
              {connectionInfo?.isDemo
                ? 'Sandbox: SMART_FACILITY_SQLITE (Multi-Domain)'
                : connectionInfo
                ? `Connected: ${connectionInfo.databaseName} (${connectionInfo.dbType.toUpperCase()})`
                : 'Disconnected: Handshake Pending'}
            </p>
          </div>
        </div>

        {/* Database Connection / Status Badge */}
        <div className="flex items-center gap-6">
          <div className="flex bg-[#0d1117] border border-[#30363d] rounded px-3 py-1 items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connectionInfo ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="text-xs font-mono text-white">
              {connectionInfo
                ? `${connectionInfo.dbType.toUpperCase()} Connected`
                : 'Handshake Pending'}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-[#30363d] hidden md:block"></div>
          <button 
            type="button"
            onClick={() => setActiveTab('connect')}
            className="px-3 py-1 bg-[#21262d] border border-[#30363d] rounded text-xs text-[#c9d1d9] hover:bg-[#30363d] transition-all hidden md:block cursor-pointer"
          >
            Settings
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-60 bg-[#0d1117] border-r border-[#30363d] px-3 py-6 flex flex-col space-y-1 shrink-0">
          <div className="px-3 mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">Navigation Modules</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#161b22] rounded border border-[#30363d] text-[#8b949e] font-mono">
              6 Modules
            </span>
          </div>
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav_btn_${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 border-l-2 transition-all text-xs font-medium cursor-pointer ${
                    isActive
                      ? 'bg-[#161b22] text-blue-400 border-blue-500'
                      : 'text-[#8b949e] hover:bg-[#161b22] hover:text-[#c9d1d9] border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-[#8b949e]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          
          <div className="pt-6 border-t border-[#30363d] px-3">
            <div className="p-3 bg-[#161b22] border border-[#30363d] rounded">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block mb-1">🛡️ Security Guardrail</span>
              <p className="text-[10px] leading-relaxed text-[#8b949e]">
                Write actions are queued as draft models. Schema executions require double-verification authorization.
              </p>
            </div>
          </div>
        </aside>

        {/* Content Container */}
        <main className="flex-1 overflow-x-hidden p-6 md:p-8 bg-[#0d1117]">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-6 bg-blue-600 flex items-center px-3 justify-between text-[10px] text-white select-none shrink-0 z-50">
        <div className="flex items-center gap-4">
          <span>Ready</span>
          <span>Spaces: 2</span>
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span className="font-bold">TASC v0.8.4-beta</span>
        </div>
      </footer>
    </div>
  );
}
