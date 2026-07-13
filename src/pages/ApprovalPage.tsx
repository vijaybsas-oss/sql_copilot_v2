/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, X, ShieldAlert, KeyRound, AlertTriangle, Play, HelpCircle, Loader2 } from 'lucide-react';
import { ApprovalItem } from '../types';
import { api } from '../api/client';

export default function ApprovalPage() {
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [activeWorkflowMode, setActiveWorkflowMode] = useState<'read_only' | 'draft' | 'approved'>('draft');
  const [confirmInput, setConfirmInput] = useState<{ [id: string]: string }>({});
  const [errorLogs, setErrorLogs] = useState<{ [id: string]: string }>({});
  const [executing, setExecuting] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const list = await api.getApprovals();
      setApprovals(list);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.submitApprovalAction(id, action);
      loadApprovals();
    } catch (err: any) {
      alert(`Error updating approval state: ${err.message}`);
    }
  };

  const handleExecute = async (item: ApprovalItem) => {
    setExecuting((prev) => ({ ...prev, [item.id]: true }));
    setErrorLogs((prev) => ({ ...prev, [item.id]: '' }));

    const confirmCode = confirmInput[item.id] || '';

    try {
      const res = await api.executeApproval(item.id, confirmCode);
      if (res.success) {
        alert('Plan executed successfully against active catalog!');
        loadApprovals();
      } else {
        setErrorLogs((prev) => ({ ...prev, [item.id]: res.error || 'Execution failed.' }));
      }
    } catch (err: any) {
      setErrorLogs((prev) => ({ ...prev, [item.id]: err.message || 'System error on database execute.' }));
    } finally {
      setExecuting((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const isDestructive = (sql: string): boolean => {
    const upper = sql.toUpperCase();
    return upper.includes('DROP TABLE') || (upper.includes('DELETE') && !upper.includes('WHERE'));
  };

  const getExpectedCode = (sql: string): string => {
    const match = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
    const tableName = match ? match[1] : 'TABLE';
    return `CONFIRM_DROP_TABLE_${tableName.toUpperCase()}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-[#8b949e] text-sm">Gathering pending DDL schema proposals and approval queues...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Security & Approval Center</h2>
          <p className="text-[#8b949e] text-xs mt-1">
            Authorize structural modifications (DDL) drafted by the copilot, configure safety lock settings, and run migrations.
          </p>
        </div>

        {/* Global Security Modes */}
        <div className="bg-[#0d1117] border border-[#30363d] p-1 rounded flex items-center">
          <span className="text-[10px] font-mono font-bold text-[#8b949e] uppercase tracking-wider px-3">Guardrail Mode:</span>
          {[
            { id: 'read_only', label: 'Read-Only Inspect' },
            { id: 'draft', label: 'Draft Suggestions' },
            { id: 'approved', label: 'Authorized Execute' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setActiveWorkflowMode(mode.id as any);
                if (mode.id === 'read_only') {
                  alert('System Guardrail Set to Read-Only. No structural queries can be dispatched.');
                }
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                activeWorkflowMode === mode.id
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-xs font-bold'
                  : 'text-[#8b949e] hover:text-slate-300'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        {approvals.length === 0 ? (
          <div className="bg-[#161b22] border border-[#30363d] rounded p-12 text-center text-slate-400 space-y-3 flex flex-col items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-blue-500/20" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Clear Approval Workspace</h3>
            <p className="text-xs leading-relaxed max-w-sm text-[#8b949e]">
              All structural alterations have been deployed. Ask the SQL copilot chat to "create a view" or "add a table" to generate structural plans.
            </p>
          </div>
        ) : (
          approvals.map((item) => {
            const destructive = isDestructive(item.sqlText);
            const expectedCode = destructive ? getExpectedCode(item.sqlText) : '';
            const needsCodeConfirm = destructive && confirmInput[item.id] !== expectedCode;

            return (
              <div
                key={item.id}
                className={`bg-[#161b22] border rounded shadow-xs overflow-hidden transition-all ${
                  destructive ? 'border-rose-500/30 ring-1 ring-rose-500/15' : 'border-[#30363d]'
                }`}
              >
                {/* Header detail */}
                <div className="px-6 py-4 border-b border-[#30363d] bg-[#161b22] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded shrink-0 ${destructive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-[#21262d] text-blue-400 border border-[#30363d]'}`}>
                      {destructive ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">{item.summary}</h3>
                      <p className="text-[11px] text-[#8b949e] mt-0.5 font-mono">
                        Objects impacted: {item.affectedObjects.join(', ') || 'N/A'} • Submitted {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold self-start sm:self-center ${
                    item.status === 'pending' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                    item.status === 'approved' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                    item.status === 'executed' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                    'bg-[#21262d] border border-[#30363d] text-[#8b949e]'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>

                {/* SQL text and explanation */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* SQL Column */}
                  <div className="lg:col-span-2 space-y-3">
                    <div className="bg-[#0d1117] text-blue-400 font-mono text-xs p-4 rounded leading-relaxed max-h-64 overflow-auto border border-[#30363d] select-all">
                      <pre>{item.sqlText}</pre>
                    </div>
                    {destructive && (
                      <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded flex items-start space-x-3 text-xs text-rose-300">
                        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-rose-400 block mb-0.5 font-mono">Destructive Statement Identified!</span>
                          <p>
                            This query alters databases or drops assets. Under security policies, you double-confirm by typing this token:
                          </p>
                          <span className="font-mono font-bold text-rose-200 block mt-1.5 select-all bg-rose-950/40 border border-rose-500/30 px-2 py-1 rounded">{expectedCode}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Control / Execution Panel */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-widest block font-mono">Deployment Actions</span>
                    
                    {/* Approve / Reject buttons */}
                    {item.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          id={`btn_approve_${item.id}`}
                          onClick={() => handleAction(item.id, 'approve')}
                          className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-2 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer font-mono"
                        >
                          <Check className="h-4 w-4" />
                          <span>Approve Draft</span>
                        </button>
                        <button
                          type="button"
                          id={`btn_reject_${item.id}`}
                          onClick={() => handleAction(item.id, 'reject')}
                          className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-2 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer font-mono"
                        >
                          <X className="h-4 w-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}

                    {/* Authorized Execution section */}
                    {(item.status === 'approved' || item.status === 'pending') && (
                      <div className="space-y-3 pt-2">
                        {destructive && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 block font-mono">Double-Confirmation Code</label>
                            <input
                              type="text"
                              value={confirmInput[item.id] || ''}
                              onChange={(e) => setConfirmInput((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
                              placeholder="Type CONFIRM_DROP_TABLE_..."
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          id={`btn_execute_${item.id}`}
                          onClick={() => handleExecute(item)}
                          disabled={executing[item.id] || activeWorkflowMode === 'read_only' || needsCodeConfirm}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded text-xs flex items-center justify-center space-x-1.5 transition-all disabled:opacity-40 shadow-xs cursor-pointer border border-blue-500 font-mono"
                        >
                          {executing[item.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white text-white" />}
                          <span>Execute Schema Alteration</span>
                        </button>
                      </div>
                    )}

                    {/* Feedback result */}
                    {item.status === 'executed' && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs rounded flex items-start space-x-2">
                        <Check className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block mb-0.5">Plan Executed Successfully</span>
                          <span className="font-mono text-[10px] text-blue-200 block leading-relaxed">{item.result}</span>
                        </div>
                      </div>
                    )}

                    {errorLogs[item.id] && (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded flex items-start space-x-2">
                        <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block mb-0.5">Database Exception</span>
                          <span className="font-mono text-[10px] text-rose-200 block leading-relaxed">{errorLogs[item.id]}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
