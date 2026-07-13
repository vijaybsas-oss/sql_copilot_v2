/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Play, Send, ShieldCheck, Loader2, Info, AlertCircle, Sparkles, 
  Database, Plus, Trash2, Edit, Check, Settings2, FileText, AlertTriangle, BookOpen, Eye
} from 'lucide-react';
import { ChatMessage, DbContextItem, DictionaryEntry, QueryAnalysisResult, DependencyAuditWarning } from '../types';
import { api } from '../api/client';
import SqlEditor from '../components/SqlEditor';

interface SqlCopilotPageProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  persistedSql: string;
  setPersistedSql: (sql: string) => void;
  persistedResult: any | null;
  setPersistedResult: (result: any | null) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
}

export default function SqlCopilotPage({
  messages,
  setMessages,
  persistedSql,
  setPersistedSql,
  persistedResult,
  setPersistedResult,
  prompt,
  setPrompt
}: SqlCopilotPageProps) {
  // Main view navigation tab
  const [activeTab, setActiveTab] = useState<'workspace' | 'settings'>('workspace');

  // Chat Copilot state
  const [loading, setLoading] = useState(false);

  // Active query execution states
  const [executing, setExecuting] = useState(false);
  const [execSql, setExecSqlInternal] = useState(persistedSql);
  const [queryResult, setQueryResultInternal] = useState<any | null>(persistedResult);
  const [dryRun, setDryRun] = useState(true);

  // Custom wrappers to keep App.tsx and local state synchronized
  const setExecSql = (sql: string) => {
    setExecSqlInternal(sql);
    setPersistedSql(sql);
  };

  const setQueryResult = (result: any | null) => {
    setQueryResultInternal(result);
    setPersistedResult(result);
  };

  // Schema state
  const [schema, setSchema] = useState<any | null>(null);

  // Custom Business Context state
  const [dbContexts, setDbContexts] = useState<DbContextItem[]>([]);
  const [editingContext, setEditingContext] = useState<DbContextItem | null>(null);
  const [ctxDomainName, setCtxDomainName] = useState('');
  const [ctxBusinessRules, setCtxBusinessRules] = useState('');
  const [ctxRelationships, setCtxRelationships] = useState('');
  const [ctxConventions, setCtxConventions] = useState('');

  // Custom Dictionary state
  const [dictionaryEntries, setDictionaryEntries] = useState<DictionaryEntry[]>([]);
  const [editingDictionary, setEditingDictionary] = useState<DictionaryEntry | null>(null);
  const [dicTableName, setDicTableName] = useState('');
  const [dicColumnName, setDicColumnName] = useState('');
  const [dicDisplayName, setDicDisplayName] = useState('');
  const [dicDescription, setDicDescription] = useState('');

  // Query Analysis & Auditor state
  const [sandboxResultTab, setSandboxResultTab] = useState<'data' | 'analysis'>('data');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<QueryAnalysisResult | null>(null);
  const [auditorWarnings, setAuditorWarnings] = useState<DependencyAuditWarning[]>([]);

  // Fetch initial data
  const loadCustomizationAndSchema = async () => {
    try {
      const sch = await api.getSchema();
      setSchema(sch);

      const contexts = await api.getDbContexts();
      setDbContexts(contexts);

      const dictionary = await api.getDictionaryEntries();
      setDictionaryEntries(dictionary);
    } catch (err) {
      console.error('Failed to load active schema or custom database definitions:', err);
    }
  };

  useEffect(() => {
    loadCustomizationAndSchema();
  }, []);

  // Sync state for context form when editing changes
  useEffect(() => {
    if (editingContext) {
      setCtxDomainName(editingContext.domainName);
      setCtxBusinessRules(editingContext.businessRules);
      setCtxRelationships(editingContext.relationships);
      setCtxConventions(editingContext.conventions);
    } else {
      setCtxDomainName('');
      setCtxBusinessRules('');
      setCtxRelationships('');
      setCtxConventions('');
    }
  }, [editingContext]);

  // Sync state for dictionary form when editing changes
  useEffect(() => {
    if (editingDictionary) {
      setDicTableName(editingDictionary.tableName);
      setDicColumnName(editingDictionary.columnName);
      setDicDisplayName(editingDictionary.displayName);
      setDicDescription(editingDictionary.description);
    } else {
      setDicTableName('');
      setDicColumnName('');
      setDicDisplayName('');
      setDicDescription('');
    }
  }, [editingDictionary]);

  const updateMessageSql = (messageId: string, newSql: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.sqlProposal) {
          return {
            ...msg,
            sqlProposal: {
              ...msg.sqlProposal,
              sql: newSql
            }
          };
        }
        return msg;
      })
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userPrompt = prompt.trim();
    setPrompt('');

    const userMsg: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await api.askCopilot(userPrompt);

      const aiMsg: ChatMessage = {
        id: 'msg_' + Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: response.explanation,
        timestamp: new Date().toLocaleTimeString(),
        sqlProposal: {
          sql: response.sql,
          explanation: response.explanation,
          affectedObjects: response.affectedObjects,
          estimatedImpact: response.estimatedImpact,
          isDdl: response.isDdl
        }
      };

      setMessages((prev) => [...prev, aiMsg]);
      
      // Auto-populate the SQL runner panel with the generated SQL
      setExecSql(response.sql);

      // Auto trigger analysis and audit on new query formulation
      runAnalysisAndAudit(response.sql, false);
    } catch (err: any) {
      const aiErrorMsg: ChatMessage = {
        id: 'msg_err_' + Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: `Error generating copilot query: ${err.message || 'Unknown server error.'}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, aiErrorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Run proposed query (read-only queries)
  const runQuery = async (sqlText: string) => {
    if (!sqlText.trim()) return;
    setExecuting(true);
    setQueryResult(null);
    setSandboxResultTab('data');

    try {
      const queryRes = await fetch('/api/approvals/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: 'appr_direct_run', // special id representing direct copilot execution
          sqlText: sqlText,
          dryRun: dryRun
        })
      });
      const data = await queryRes.json();
      if (queryRes.ok) {
        setQueryResult({ 
          success: true, 
          data: data.result ? [] : data.data || [], 
          rowCount: data.rowCount || 0,
          isDryRun: data.isDryRun
        });
      } else {
        setQueryResult({ success: false, error: data.error || 'Execution failed.', isDryRun: data.isDryRun });
      }

      // Automatically compile audit analysis so user stays updated
      runAnalysisAndAudit(sqlText, false);
    } catch (err: any) {
      setQueryResult({ success: false, error: err.message || 'Query execution exception.' });
    } finally {
      setExecuting(false);
    }
  };

  // Trigger plain-English Query Analysis & Naming Dictionary mappings
  const runAnalysisAndAudit = async (sqlText: string, switchTab = true) => {
    if (!sqlText.trim()) return;
    setAnalyzing(true);
    if (switchTab) setSandboxResultTab('analysis');
    try {
      const res = await api.analyzeQuery(sqlText);
      setAnalysisResult(res.analysis);
      setAuditorWarnings(res.warnings);
    } catch (err) {
      console.error('Failed to perform deep SQL query analysis:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Send plan to Approval Center (for DDL changes)
  const sendToApprovals = async (proposal: any) => {
    try {
      await api.createApproval({
        sqlText: proposal.sql,
        summary: `Drawn from Copilot Request: ${proposal.explanation.substring(0, 60)}...`,
        affectedObjects: proposal.affectedObjects
      });
      alert('Schema draft proposal dispatched successfully to the Approval Center!');
    } catch (err: any) {
      alert(`Failed to register approval item: ${err.message}`);
    }
  };

  // Handle Context Management Form Actions
  const handleSaveContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctxDomainName.trim()) return;

    try {
      await api.saveDbContext({
        id: editingContext?.id,
        domainName: ctxDomainName,
        businessRules: ctxBusinessRules,
        relationships: ctxRelationships,
        conventions: ctxConventions
      });
      setEditingContext(null);
      // reload
      const contexts = await api.getDbContexts();
      setDbContexts(contexts);
      alert('Domain Business Context updated and synchronized with AI engine.');
    } catch (err: any) {
      alert(`Error saving business context: ${err.message}`);
    }
  };

  const handleDeleteContext = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom business context?')) return;
    try {
      await api.deleteDbContext(id);
      if (editingContext?.id === id) setEditingContext(null);
      const contexts = await api.getDbContexts();
      setDbContexts(contexts);
    } catch (err: any) {
      alert(`Error deleting business context: ${err.message}`);
    }
  };

  // Handle Custom Dictionary Form Actions
  const handleSaveDictionary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dicTableName || !dicColumnName.trim() || !dicDisplayName.trim()) {
      alert('Please fill out table, technical column, and display name attributes.');
      return;
    }

    try {
      await api.saveDictionaryEntry({
        id: editingDictionary?.id,
        tableName: dicTableName,
        columnName: dicColumnName.trim(),
        displayName: dicDisplayName.trim(),
        description: dicDescription
      });
      setEditingDictionary(null);
      // reload
      const dictionary = await api.getDictionaryEntries();
      setDictionaryEntries(dictionary);
      alert('Technical column mapping registered successfully in custom dictionary.');
    } catch (err: any) {
      alert(`Error saving dictionary mapping: ${err.message}`);
    }
  };

  const handleDeleteDictionary = async (id: string) => {
    if (!confirm('Remove this custom column mapping entry?')) return;
    try {
      await api.deleteDictionaryEntry(id);
      if (editingDictionary?.id === id) setEditingDictionary(null);
      const dictionary = await api.getDictionaryEntries();
      setDictionaryEntries(dictionary);
    } catch (err: any) {
      alert(`Error deleting dictionary mapping: ${err.message}`);
    }
  };

  // Helper to render the data results tab pane
  const renderDataResults = () => {
    if (executing) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-slate-500 text-xs font-mono">Querying database engine...</span>
        </div>
      );
    }

    if (!queryResult) {
      return (
        <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center justify-center space-y-2 h-full font-mono">
          <Info className="h-5 w-5 text-slate-600" />
          <span>Draft a SELECT query in the AI console or write manually and click "Execute Query" to inspect active tables.</span>
        </div>
      );
    }

    if (!queryResult.success) {
      return (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded flex items-start space-x-3 text-xs font-mono">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-rose-400 block mb-0.5">Execution Error</span>
            <span>{queryResult.error}</span>
          </div>
        </div>
      );
    }

    if (queryResult.data && queryResult.data.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse bg-[#0d1117]">
            <thead className="sticky top-0 bg-[#161b22] border-b border-[#30363d] text-[#8b949e] z-10 font-mono">
              <tr>
                {Object.keys(queryResult.data[0]).map((k) => {
                  const mapping = dictionaryEntries.find(d => d.columnName.toLowerCase() === k.toLowerCase());
                  return (
                    <th key={k} className="px-3 py-2 font-semibold text-[9px] bg-[#161b22] text-[#8b949e]" title={mapping ? `Technical column: ${k}\n${mapping.description}` : k}>
                      <div className="flex flex-col uppercase tracking-wider">
                        {mapping ? (
                          <>
                            <span className="text-blue-400 font-bold">{mapping.displayName}</span>
                            <span className="text-[8px] text-slate-600 font-mono font-normal">({k})</span>
                          </>
                        ) : (
                          <span>{k}</span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d] text-[#c9d1d9] font-mono text-[10px]">
              {queryResult.data.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#21262d]/50 bg-[#0d1117]">
                  {Object.values(row).map((val: any, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 max-w-40 truncate" title={String(val)}>
                      {val === null ? 'NULL' : String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center justify-center space-y-2 h-full font-mono">
        <Database className="h-6 w-6 text-slate-600" />
        <span>Query executed successfully. Zero data records returned (empty set or non-SELECT transaction).</span>
      </div>
    );
  };

  // Helper to render the query analysis and auditor tab pane
  const renderQueryAnalysis = () => {
    if (analyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-slate-400 text-xs font-mono text-center">AI compiling business rules & auditing foreign-key constraints...</span>
        </div>
      );
    }

    if (!analysisResult) {
      return (
        <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center justify-center space-y-2 h-full font-mono">
          <BookOpen className="h-5 w-5 text-slate-600" />
          <span>No active query analysis. Compile or type a statement in the Sandbox editor and click "Analyze & Audit".</span>
        </div>
      );
    }

    return (
      <div className="space-y-5 text-xs">
        {/* Operation type & affected overview */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[9px] font-mono uppercase font-bold text-slate-500">Operation:</span>
          <span className="bg-[#21262d] text-blue-400 border border-[#30363d] px-2 py-0.5 rounded font-bold font-mono uppercase text-[9px]">
            {analysisResult.operationType}
          </span>

          <span className="text-[9px] font-mono uppercase font-bold text-slate-500 ml-3">Referenced Tables:</span>
          {analysisResult.retrievedTables.map(t => (
            <span key={t} className="bg-[#161b22] border border-[#30363d] text-[#c9d1d9] px-1.5 py-0.5 rounded font-mono font-bold text-[9px]">
              {t}
            </span>
          ))}
        </div>

        {/* Plain English explanation card */}
        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded space-y-2">
          <div className="flex items-center space-x-1.5 text-slate-200 font-bold uppercase tracking-wider text-[10px]">
            <FileText className="h-3.5 w-3.5 text-blue-400" />
            <span>AI Structural Intent Translation</span>
          </div>
          <p className="text-[#c9d1d9] leading-relaxed font-sans mt-1">
            {analysisResult.explanation}
          </p>
        </div>

        {/* Automated Dependency Auditor Warnings */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-slate-400 font-bold uppercase tracking-wider text-[10px] font-mono">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Automated Dependency Auditor Logs</span>
          </div>

          {auditorWarnings.length === 0 ? (
            <div className="p-3.5 bg-green-500/5 border border-green-500/10 rounded flex items-center space-x-2 text-green-400 font-sans">
              <Check className="h-4 w-4 text-green-500 shrink-0" />
              <span>Constraint verification clean. Foreign key indices, safety guardrails, and key relationships check out.</span>
            </div>
          ) : (
            <div className="space-y-2 font-sans">
              {auditorWarnings.map((warn, i) => (
                <div key={i} className={`p-4 rounded border flex items-start space-x-3 ${
                  warn.type === 'danger' 
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
                    : warn.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                }`}>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold block uppercase tracking-wide text-[10px]">
                      {warn.message} ({warn.tables.join(', ')})
                    </span>
                    <p className="leading-relaxed text-[11px] text-slate-300">{warn.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resolved Custom Friendly Terms overlay */}
        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded space-y-3">
          <span className="font-bold text-slate-400 uppercase tracking-widest block text-[9px] font-mono">Dictionary Mapping Terminology Check</span>
          <div className="flex flex-wrap gap-2">
            {analysisResult.filteredColumns.length === 0 ? (
              <span className="text-slate-500 text-[10px] font-mono">No columns detected.</span>
            ) : (
              analysisResult.filteredColumns.map(col => {
                const matched = dictionaryEntries.find(d => d.columnName.toLowerCase() === col.toLowerCase());
                return (
                  <div key={col} className="bg-[#0d1117] border border-[#30363d] px-2.5 py-1.5 rounded flex items-center space-x-2">
                    <span className="font-mono text-slate-400 text-[10px]">{col}</span>
                    {matched && (
                      <>
                        <span className="text-slate-600 text-[10px]">→</span>
                        <span className="text-blue-400 font-bold font-sans text-[10px]">{matched.displayName}</span>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Step by Step Flow */}
        <div className="space-y-2">
          <span className="font-bold text-slate-400 uppercase tracking-widest block text-[9px] font-mono">Database Query Evaluation Blueprint</span>
          <div className="border-l-2 border-[#30363d] pl-4 space-y-3 font-mono text-[10px]">
            {analysisResult.stepByStep.map((step, idx) => (
              <div key={idx} className="relative">
                <span className="absolute -left-[21px] top-0.5 bg-[#21262d] border border-[#30363d] h-2.5 w-2.5 rounded-full" />
                <p className="text-slate-300 leading-normal">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header and Tab Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#30363d] pb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">AI SQL Copilot Workspace</h2>
          <p className="text-[#8b949e] text-xs mt-1">
            Draft queries using natural language, configure domain business rules, and run secure database audits.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#0d1117] p-1 rounded border border-[#30363d]">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'workspace' 
                ? 'bg-[#161b22] text-blue-400 border border-[#30363d] shadow-xs' 
                : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>AI Copilot & Sandbox</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-[#161b22] text-blue-400 border border-[#30363d] shadow-xs' 
                : 'text-[#8b949e] hover:text-[#c9d1d9]'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>AI Context & Custom Dictionary</span>
          </button>
        </div>
      </div>

      {activeTab === 'workspace' ? (
        /* Workspace Tab: Contains existing Chat Interface and safe evaluation sandbox */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Column: AI Assistant Chat */}
          <div className="bg-[#161b22] border border-[#30363d] rounded flex flex-col h-[740px] shadow-xs overflow-hidden">
            {/* Console Header */}
            <div className="px-6 py-4 border-b border-[#30363d] bg-[#0d1117] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-blue-400 animate-pulse" />
                <span className="font-bold text-white text-xs uppercase tracking-wider">AI Engineering Console</span>
              </div>
              <span className="bg-[#21262d] text-blue-400 text-[9px] px-2 py-0.5 rounded border border-[#30363d] font-bold font-mono">
                Context Active ({dbContexts.length} Domains)
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#0d1117]/40">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded text-xs max-w-[85%] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-tr-none font-mono' 
                      : 'bg-[#0d1117] text-[#c9d1d9] rounded-tl-none border border-[#30363d]'
                  }`}>
                    <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>

                    {msg.sqlProposal && (
                      <div className="mt-4 bg-[#0d1117] text-[#c9d1d9] rounded p-4 space-y-3 font-mono border border-[#30363d] select-all">
                        <div className="flex items-center justify-between text-[10px] text-[#8b949e] font-bold border-b border-[#30363d] pb-2">
                          <span>{msg.sqlProposal.isDdl ? 'STRUCTURAL SCHEMA PLAN (DDL)' : 'READ-ONLY DATA QUERY'}</span>
                          <span className="text-blue-400 font-bold">Cost: {msg.sqlProposal.estimatedImpact}</span>
                        </div>
                        <div className="h-32">
                          <SqlEditor
                            value={msg.sqlProposal.sql}
                            onChange={(newSql) => updateMessageSql(msg.id, newSql)}
                            placeholder="-- Edit SQL statement here..."
                          />
                        </div>

                        <div className="flex space-x-2 pt-2 border-t border-[#30363d] font-sans">
                          {!msg.sqlProposal.isDdl ? (
                            <button
                              type="button"
                              onClick={() => {
                                setExecSql(msg.sqlProposal!.sql);
                                runQuery(msg.sqlProposal!.sql);
                              }}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] px-3 py-1.5 rounded transition-all flex items-center space-x-1 cursor-pointer"
                            >
                              <Play className="h-3 w-3 fill-white text-white" />
                              <span>Evaluate SELECT Query</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => sendToApprovals(msg.sqlProposal)}
                              className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white font-bold text-[10px] px-3 py-1.5 rounded transition-all flex items-center space-x-1 cursor-pointer"
                            >
                              <ShieldCheck className="h-3 w-3 text-blue-400" />
                              <span>Dispatch to approvals</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setExecSql(msg.sqlProposal!.sql);
                              runAnalysisAndAudit(msg.sqlProposal!.sql, true);
                            }}
                            className="bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] text-[10px] px-3 py-1.5 rounded font-medium transition-all cursor-pointer flex items-center space-x-1"
                          >
                            <Eye className="h-3 w-3 text-[#8b949e]" />
                            <span>Analyze Query</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-[#8b949e] mt-1 px-1 font-mono">{msg.timestamp}</span>
                </div>
              ))}
              
              {loading && (
                <div className="flex items-center space-x-2 bg-[#0d1117] border border-[#30363d] rounded p-3 text-[#8b949e] text-xs w-48 self-start font-mono">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>AI formulating SQL...</span>
                </div>
              )}
            </div>

            {/* Chat Form */}
            <form onSubmit={handleSend} className="p-4 border-t border-[#30363d] bg-[#0d1117] flex space-x-3 shrink-0">
              <input
                type="text"
                id="input_prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-4 py-2.5 text-xs text-[#c9d1d9] focus:outline-none focus:border-blue-500 placeholder-[#8b949e] font-mono"
                placeholder="Query BMS zones, maintenance spend, water flows, or current imbalance..."
                disabled={loading}
              />
              <button
                type="submit"
                id="btn_submit_prompt"
                disabled={loading || !prompt.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white p-2.5 rounded transition-all shadow-xs flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Right Column: SQL Evaluation Runner and Visual Analyzer */}
          <div className="bg-[#161b22] border border-[#30363d] rounded p-6 h-[740px] flex flex-col shadow-xs space-y-4 overflow-hidden">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Query Sandbox & Security Auditor</h3>
              <p className="text-xs text-[#8b949e] mt-1">Review live query execution outputs, custom display-term overlays, and integrity warnings.</p>
            </div>

            {/* SQL Code Runner Editor */}
            <div className="space-y-2 shrink-0">
              <SqlEditor
                value={execSql}
                onChange={setExecSql}
                placeholder="-- Write standard SQL SELECT statement to analyze and evaluate..."
              />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                <div className="flex items-center space-x-3 bg-[#0d1117] px-3 py-1.5 rounded border border-[#30363d]">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      id="chk_dry_run"
                      checked={dryRun} 
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-8 h-4 bg-[#21262d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[2px] after:bg-slate-500 after:border-slate-400 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600 peer-checked:after:bg-amber-100 peer-checked:after:border-amber-400"></div>
                    <span className="ml-2 text-[10px] font-semibold text-[#c9d1d9] tracking-wide font-sans">Dry Run (Commit & Rollback)</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2 self-end">
                  <button
                    type="button"
                    onClick={() => runAnalysisAndAudit(execSql, true)}
                    disabled={analyzing || !execSql.trim()}
                    className="bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] font-semibold px-3 py-2 rounded text-xs flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
                    title="Run deep AI analysis & check FK integrity constraints"
                  >
                    {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" /> : <Eye className="h-3.5 w-3.5 text-[#8b949e]" />}
                    <span>Analyze & Audit</span>
                  </button>

                  <button
                    type="button"
                    id="btn_run_sql"
                    onClick={() => runQuery(execSql)}
                    disabled={executing || !execSql.trim()}
                    className={`${dryRun ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'} font-semibold px-4 py-2 rounded text-xs flex items-center space-x-1.5 transition-all disabled:opacity-50 shadow-xs cursor-pointer font-mono`}
                  >
                    {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-white text-white" />}
                    <span>{dryRun ? 'Dry Run Query' : 'Execute Query'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Visualizer & Auditor Result Tab Panel */}
            <div className="flex-1 border border-[#30363d] rounded overflow-hidden flex flex-col bg-[#0d1117]">
              {/* Tab Toggles */}
              <div className="bg-[#161b22] border-b border-[#30363d] px-4 flex items-center justify-between shrink-0 font-sans">
                <div className="flex space-x-4">
                  <button
                    onClick={() => setSandboxResultTab('data')}
                    className={`py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 font-mono transition-all cursor-pointer ${
                      sandboxResultTab === 'data' 
                        ? 'text-blue-400 border-blue-500' 
                        : 'text-[#8b949e] border-transparent hover:text-[#c9d1d9]'
                    }`}
                  >
                    Data Results Output {queryResult?.rowCount !== undefined && `(${queryResult.rowCount})`}
                  </button>
                  <button
                    onClick={() => setSandboxResultTab('analysis')}
                    className={`py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 font-mono transition-all flex items-center space-x-1 cursor-pointer ${
                      sandboxResultTab === 'analysis' 
                        ? 'text-blue-400 border-blue-500' 
                        : 'text-[#8b949e] border-transparent hover:text-[#c9d1d9]'
                    }`}
                  >
                    <span>AI Breakdown & Audit Warning Logs</span>
                    {auditorWarnings.length > 0 && (
                      <span className="bg-amber-500 text-[#0f172a] text-[9px] font-black px-1.5 py-0.2 rounded-full leading-none">
                        {auditorWarnings.length}
                      </span>
                    )}
                  </button>
                </div>

                {queryResult?.isDryRun && (
                  <span className="text-[9px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                    🛡️ Rolled Back
                  </span>
                )}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-auto p-4">
                {sandboxResultTab === 'data' ? renderDataResults() : renderQueryAnalysis()}
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Settings Tab: Custom Database Business Context & Custom Dictionary mapping UI */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Column: Database Context Manager */}
          <div className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Domain Business Contexts</h3>
              </div>
              <p className="text-xs text-[#8b949e] mt-1">
                Define the domain guidelines, logical relationships, and operational standards of industrial systems like BMS or Water Management. The AI uses this context to interpret database structures seamlessly.
              </p>
            </div>

            {/* List of Contexts */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block font-mono">Active Domain Settings Profiles</span>
              {dbContexts.length === 0 ? (
                <div className="p-4 bg-[#0d1117] border border-[#30363d] text-center rounded text-[#8b949e] text-xs">
                  No custom business contexts defined. Define one below to guide AI reasoning.
                </div>
              ) : (
                <div className="space-y-2">
                  {dbContexts.map((ctx) => (
                    <div key={ctx.id} className="bg-[#0d1117] border border-[#30363d] rounded p-4 flex justify-between items-start gap-4">
                      <div className="space-y-2 text-xs">
                        <span className="font-bold text-slate-200 uppercase tracking-wide text-[11px] block">{ctx.domainName}</span>
                        <div className="space-y-1 text-[#8b949e] leading-normal text-[11px]">
                          <p><span className="font-bold text-blue-400 font-mono text-[9px] uppercase tracking-wide">Rules:</span> {ctx.businessRules}</p>
                          <p><span className="font-bold text-blue-400 font-mono text-[9px] uppercase tracking-wide">Relations:</span> {ctx.relationships}</p>
                          <p><span className="font-bold text-blue-400 font-mono text-[9px] uppercase tracking-wide">Naming:</span> {ctx.conventions}</p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setEditingContext(ctx)}
                          className="p-1.5 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] rounded transition-all cursor-pointer"
                          title="Edit Business Context"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteContext(ctx.id)}
                          className="p-1.5 bg-rose-950/40 border border-rose-500/20 text-rose-400 hover:bg-rose-900/30 rounded transition-all cursor-pointer"
                          title="Delete Business Context"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Context Form */}
            <form onSubmit={handleSaveContext} className="bg-[#0d1117] border border-[#30363d] p-5 rounded space-y-4">
              <span className="text-[10px] uppercase font-bold text-[#c9d1d9] tracking-wider block font-mono border-b border-[#30363d] pb-2">
                {editingContext ? '✏️ Edit Domain Context Profile' : '➕ Create Domain Context Profile'}
              </span>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Domain System Name</label>
                  <input
                    type="text"
                    required
                    value={ctxDomainName}
                    onChange={(e) => setCtxDomainName(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="e.g. BMS (Building Management System) or Water Flow"
                  />
                </div>

                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Business Target Rules</label>
                  <textarea
                    rows={2}
                    value={ctxBusinessRules}
                    onChange={(e) => setCtxBusinessRules(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Temperature range target bounds or flow rate thresholds..."
                  />
                </div>

                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Explicit Table Relationships</label>
                  <textarea
                    rows={2}
                    value={ctxRelationships}
                    onChange={(e) => setCtxRelationships(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500"
                    placeholder="e.g. BmsLogs maps back to BmsPoints using BmsPoints.PointID foreign-key..."
                  />
                </div>

                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Naming & Metric Standards</label>
                  <textarea
                    rows={2}
                    value={ctxConventions}
                    onChange={(e) => setCtxConventions(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500"
                    placeholder="e.g. val_01 is always Water Velocity logged in Liters per minute..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#30363d]">
                {editingContext && (
                  <button
                    type="button"
                    onClick={() => setEditingContext(null)}
                    className="px-3 py-1.5 text-xs text-slate-400 bg-[#21262d] hover:bg-[#30363d] rounded border border-[#30363d] transition-all cursor-pointer font-semibold uppercase"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-all cursor-pointer font-bold uppercase tracking-wider flex items-center space-x-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{editingContext ? 'Update Context' : 'Register Context'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Custom Column Dictionary */}
          <div className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-6">
            <div>
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Naming Dictionary UI</h3>
              </div>
              <p className="text-xs text-[#8b949e] mt-1">
                Map obscure technical column names in your relational tables (e.g. <span className="font-mono text-blue-400">'val_01'</span>) to domain-specific business terms (e.g. <span className="font-mono text-blue-400">'Water Flow Rate'</span>). The AI translates metrics using these friendly term overlays in reports.
              </p>
            </div>

            {/* List of Dictionary mappings */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#8b949e] tracking-wider block font-mono">Mapped Technical Columns dictionary</span>
              {dictionaryEntries.length === 0 ? (
                <div className="p-4 bg-[#0d1117] border border-[#30363d] text-center rounded text-[#8b949e] text-xs">
                  No column mappings registered in dictionary. Create one below to translate values.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-56 border border-[#30363d] rounded">
                  <table className="w-full text-left text-xs border-collapse font-sans bg-[#0d1117]">
                    <thead>
                      <tr className="bg-[#161b22] border-b border-[#30363d] text-[#8b949e] font-mono text-[9px] uppercase tracking-wider">
                        <th className="px-3 py-2 font-bold">Table.Column</th>
                        <th className="px-3 py-2 font-bold">Friendly Term Display</th>
                        <th className="px-3 py-2 font-bold">Description</th>
                        <th className="px-3 py-2 font-bold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30363d] text-[#c9d1d9] text-[11px] font-mono">
                      {dictionaryEntries.map((dic) => (
                        <tr key={dic.id} className="hover:bg-[#21262d]/50">
                          <td className="px-3 py-2 whitespace-nowrap text-[#c9d1d9]">
                            {dic.tableName}.<span className="font-bold text-blue-400">{dic.columnName}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-sans font-bold text-blue-400">
                            {dic.displayName}
                          </td>
                          <td className="px-3 py-2 font-sans text-[#8b949e] max-w-44 truncate" title={dic.description}>
                            {dic.description || 'N/A'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-center">
                            <div className="flex justify-center space-x-1">
                              <button
                                onClick={() => setEditingDictionary(dic)}
                                className="p-1 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] rounded transition-all cursor-pointer"
                                title="Edit Mapping"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteDictionary(dic.id)}
                                className="p-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-rose-400 hover:bg-rose-900/30 rounded transition-all cursor-pointer"
                                title="Delete Mapping"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dictionary form */}
            <form onSubmit={handleSaveDictionary} className="bg-[#0d1117] border border-[#30363d] p-5 rounded space-y-4">
              <span className="text-[10px] uppercase font-bold text-[#c9d1d9] tracking-wider block font-mono border-b border-[#30363d] pb-2">
                {editingDictionary ? '✏️ Edit Technical Column Mapping' : '➕ Create Technical Column Mapping'}
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Table Name</label>
                  {schema?.tables ? (
                    <select
                      value={dicTableName}
                      onChange={(e) => setDicTableName(e.target.value)}
                      required
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500 font-mono"
                    >
                      <option value="">-- Select Table --</option>
                      {schema.tables.map((t: any) => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={dicTableName}
                      onChange={(e) => setDicTableName(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500 font-mono"
                      placeholder="e.g. WaterLogs"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Technical Column Name</label>
                  <input
                    type="text"
                    required
                    value={dicColumnName}
                    onChange={(e) => setDicColumnName(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="e.g. FlowRateLps or val_01"
                  />
                </div>

                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Domain friendly Display Name</label>
                  <input
                    type="text"
                    required
                    value={dicDisplayName}
                    onChange={(e) => setDicDisplayName(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Water Flow Rate (L/s)"
                  />
                </div>

                <div>
                  <label className="block text-[#8b949e] font-semibold mb-1 font-mono text-[10px] uppercase tracking-wider">Technical Description</label>
                  <input
                    type="text"
                    value={dicDescription}
                    onChange={(e) => setDicDescription(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Momentary velocity velocity in pipe"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#30363d]">
                {editingDictionary && (
                  <button
                    type="button"
                    onClick={() => setEditingDictionary(null)}
                    className="px-3 py-1.5 text-xs text-slate-400 bg-[#21262d] hover:bg-[#30363d] rounded border border-[#30363d] transition-all cursor-pointer font-semibold uppercase"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-all cursor-pointer font-bold uppercase tracking-wider flex items-center space-x-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{editingDictionary ? 'Update Mapping' : 'Register Mapping'}</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}
