/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Network, Table2, Eye, Cpu, Database, ChevronRight, FileText, Calendar, Loader2 } from 'lucide-react';
import { SchemaMetadata, DependencyGraph as GraphData } from '../types';
import { api } from '../api/client';
import DependencyGraph from '../components/DependencyGraph';

export default function SchemaExplorerPage() {
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<SchemaMetadata | null>(null);
  const [deps, setDeps] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedType, setSelectedType] = useState<'table' | 'view' | 'procedure'>('table');
  const [selectedName, setSelectedName] = useState<string>('');

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const sch = await api.getSchema();
      const dp = await api.getDependencies();
      setSchema(sch);
      setDeps(dp);

      // Auto-select first item
      if (sch.tables && sch.tables.length > 0) {
        setSelectedType('table');
        setSelectedName(sch.tables[0].name);
      } else if (sch.views && sch.views.length > 0) {
        setSelectedType('view');
        setSelectedName(sch.views[0].name);
      }
    } catch (err: any) {
      console.error('Failed to load schema details:', err);
      setError(err.message || 'Failed to extract database schema catalog details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-[#8b949e] text-sm">Inspecting active database schemas, view references, and catalog structures...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 max-w-2xl mx-auto my-12 text-center space-y-5 shadow-lg">
        <div className="bg-amber-500/10 text-amber-500 p-3.5 rounded-full w-14 h-14 flex items-center justify-center mx-auto border border-amber-500/20">
          <Database className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wide">Schema Extraction Refused</h3>
          <p className="text-xs text-[#8b949e] leading-relaxed max-w-md mx-auto">
            The active database connection completed its handshake successfully, but database permissions or catalog querying restrictions blocked schema extraction.
          </p>
        </div>
        <div className="bg-[#0d1117] text-amber-400 p-4 rounded border border-[#30363d] font-mono text-xs text-left max-h-48 overflow-y-auto select-all leading-relaxed whitespace-pre-wrap">
          {error}
        </div>
        <div className="pt-3 flex justify-center">
          <button
            type="button"
            onClick={loadMetadata}
            className="border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 bg-blue-500/10 px-5 py-2.5 rounded text-xs font-bold transition-all cursor-pointer uppercase tracking-wider"
          >
            Retry Catalog Extraction
          </button>
        </div>
      </div>
    );
  }

  // Get active object details
  const activeTable = selectedType === 'table' ? schema?.tables.find((t) => t.name === selectedName) : null;
  const activeView = selectedType === 'view' ? schema?.views.find((v) => v.name === selectedName) : null;
  const activeProc = selectedType === 'procedure' ? schema?.procedures.find((p) => p.name === selectedName) : null;

  // Find relationships for visual rendering
  const activeReferences = deps?.links.filter((l) => l.source === selectedName || l.target === selectedName) || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Active Schema Explorer</h2>
          <p className="text-[#8b949e] text-xs mt-1">Browse tables, analyze columns, view stored SQL routines, and inspect functional dependency graphs.</p>
        </div>
        <button
          type="button"
          onClick={loadMetadata}
          className="border border-[#30363d] hover:bg-[#30363d] text-[#c9d1d9] bg-[#21262d] px-4 py-2 rounded text-xs font-semibold transition-all cursor-pointer"
        >
          Refresh Catalog
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Hierarchy Catalog Browser */}
        <div className="bg-[#161b22] border border-[#30363d] rounded p-5 shadow-xs space-y-6">
          {/* Tables Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8b949e] uppercase tracking-widest flex items-center space-x-2">
              <Table2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Tables ({schema?.tables.length || 0})</span>
            </h3>
            <div className="space-y-1.5 pl-2">
              {schema?.tables.map((t) => {
                const isSelected = selectedType === 'table' && selectedName === t.name;
                return (
                  <button
                    key={t.name}
                    id={`btn_explore_${t.name}`}
                    onClick={() => {
                      setSelectedType('table');
                      setSelectedName(t.name);
                    }}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 font-semibold'
                        : 'text-slate-400 hover:bg-[#21262d]/50 border-transparent'
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="text-[10px] text-slate-500 bg-[#0d1117] px-1.5 py-0.5 rounded border border-[#30363d] font-mono">
                      {t.rowCount} rows
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Views Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8b949e] uppercase tracking-widest flex items-center space-x-2">
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              <span>Views ({schema?.views.length || 0})</span>
            </h3>
            <div className="space-y-1.5 pl-2">
              {schema?.views.map((v) => {
                const isSelected = selectedType === 'view' && selectedName === v.name;
                return (
                  <button
                    key={v.name}
                    id={`btn_explore_${v.name}`}
                    onClick={() => {
                      setSelectedType('view');
                      setSelectedName(v.name);
                    }}
                    className={`w-full flex items-center text-left px-3 py-2 rounded text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 font-semibold'
                        : 'text-slate-400 hover:bg-[#21262d]/50 border-transparent'
                    }`}
                  >
                    <span className="truncate">{v.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stored Procedures Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#8b949e] uppercase tracking-widest flex items-center space-x-2">
              <Cpu className="h-3.5 w-3.5 text-slate-500" />
              <span>Procedures ({schema?.procedures.length || 0})</span>
            </h3>
            <div className="space-y-1.5 pl-2">
              {schema?.procedures.map((p) => {
                const isSelected = selectedType === 'procedure' && selectedName === p.name;
                return (
                  <button
                    key={p.name}
                    id={`btn_explore_${p.name}`}
                    onClick={() => {
                      setSelectedType('procedure');
                      setSelectedName(p.name);
                    }}
                    className={`w-full flex items-center text-left px-3 py-2 rounded text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 font-semibold'
                        : 'text-slate-400 hover:bg-[#21262d]/50 border-transparent'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Details and Dependency mapping */}
        <div className="lg:col-span-3 space-y-6">
          {/* Object Detail Card */}
          <div className="bg-[#161b22] border border-[#30363d] rounded shadow-xs overflow-hidden">
            <div className="bg-[#161b22] border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-[#0d1117] p-2 border border-[#30363d] rounded text-slate-300">
                  {selectedType === 'table' ? <Table2 className="h-5 w-5 text-blue-400" /> : selectedType === 'view' ? <Eye className="h-5 w-5 text-blue-400" /> : <Cpu className="h-5 w-5 text-amber-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 leading-tight uppercase tracking-wider">{selectedName}</h3>
                  <p className="text-[10px] font-mono text-[#8b949e] mt-1 uppercase tracking-wider">Type: {selectedType.toUpperCase()} • Schema: dbo</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* TABLE details */}
              {activeTable && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">Column Structure Catalog</h4>
                    <div className="overflow-x-auto border border-[#30363d] rounded bg-[#0d1117]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#161b22] border-b border-[#30363d] text-[#8b949e] font-mono">
                            <th className="px-4 py-3 font-semibold">Column Name</th>
                            <th className="px-4 py-3 font-semibold">Data Type</th>
                            <th className="px-4 py-3 font-semibold">Nullable</th>
                            <th className="px-4 py-3 font-semibold">Keys / Constraints</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#30363d] text-[#c9d1d9] font-mono text-[11px]">
                          {activeTable.columns.map((col) => (
                            <tr key={col.name} className="hover:bg-[#161b22]/50">
                              <td className="px-4 py-3 font-bold text-slate-200">{col.name}</td>
                              <td className="px-4 py-3 text-blue-400 font-mono">{col.type}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${col.nullable ? 'bg-[#21262d] text-slate-400 border border-[#30363d]' : 'bg-green-500/10 text-green-400 border border-green-500/30'}`}>
                                  {col.nullable ? 'YES' : 'NOT NULL'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {col.isPrimary && (
                                    <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                      🔑 PRIMARY KEY
                                    </span>
                                  )}
                                  {col.isForeign && (
                                    <span className="bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-medium px-1.5 py-0.5 rounded">
                                      🔗 FK ➔ {col.foreignTable}.{col.foreignColumn}
                                    </span>
                                  )}
                                  {!col.isPrimary && !col.isForeign && <span className="text-slate-600">-</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW details */}
              {activeView && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">Target Projection Columns</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeView.columns.map((col) => (
                        <span key={col} className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded text-xs font-medium font-mono">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">View SQL definition</h4>
                    <div className="bg-[#0d1117] text-[#c9d1d9] rounded p-4 overflow-x-auto font-mono text-xs leading-relaxed max-h-80 select-all border border-[#30363d]">
                      <pre>{activeView.definition}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* PROCEDURE details */}
              {activeProc && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">Stored Parameters</h4>
                    {activeProc.parameters.length === 0 ? (
                      <p className="text-xs text-slate-500 font-mono">This stored procedure takes zero parameters.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {activeProc.parameters.map((p) => (
                          <span key={p.name} className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded text-xs font-mono">
                            <span className="font-bold text-slate-200">{p.name}</span>: {p.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 font-mono">Procedural Routine Definition</h4>
                    <div className="bg-[#0d1117] text-[#c9d1d9] rounded p-4 overflow-x-auto font-mono text-xs leading-relaxed max-h-80 select-all border border-[#30363d]">
                      <pre>{activeProc.definition}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visual Dependency Graph Card */}
          <div className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide font-mono">Functional Dependency Diagram</h3>
              <p className="text-[#8b949e] text-[11px] mt-1">Captures architectural relationships (foreign key links and compiled views referencing underlying datasets).</p>
            </div>

            <DependencyGraph
              data={deps}
              selectedName={selectedName}
              onSelectNode={(name, type) => {
                setSelectedType(type);
                setSelectedName(name);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
