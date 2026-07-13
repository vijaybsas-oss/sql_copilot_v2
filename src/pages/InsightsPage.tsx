/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LineChart, BarChart3, AlertTriangle, ShieldCheck, HelpCircle, Loader2, Play, Grid, Calendar, Activity, Cpu, Layers } from 'lucide-react';
import { DbSummary as EmsSummary, ProfileResult, SchemaMetadata } from '../types';
import { api } from '../api/client';

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<SchemaMetadata | null>(null);
  const [emsSummary, setEmsSummary] = useState<EmsSummary | null>(null);

  // Profiling state
  const [targetTable, setTargetTable] = useState<string>('');
  const [profiling, setProfiling] = useState(false);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);

  // Sample data state
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'profiler' | 'sample'>('profiler');

  useEffect(() => {
    loadPageData();
  }, []);

  const loadPageData = async () => {
    setLoading(true);
    try {
      const sch = await api.getSchema();
      setSchema(sch);

      const summary = await api.getEmsSummary();
      setEmsSummary(summary);

      // Default target table
      if (sch.tables && sch.tables.length > 0) {
        const defaultTable = sch.tables.find((t) => t.name.toLowerCase().includes('log'))?.name || sch.tables[0].name;
        setTargetTable(defaultTable);
        triggerProfile(defaultTable);
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerProfile = async (tableName: string) => {
    setProfiling(true);
    setSampleError(null);
    try {
      const result = await api.profileTable(tableName);
      setProfileResult(result);

      const sample = await api.getSampleData(tableName, 30);
      if (sample.success && sample.data) {
        setSampleData(sample.data);
      } else {
        setSampleError(sample.error || 'Failed to retrieve sample records.');
      }
    } catch (err: any) {
      console.error('Failed to profile table:', err);
    } finally {
      setProfiling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-[#8b949e] text-sm">Running data-profile jobs, loading energy log sets, and running anomaly calculations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Multi-Domain Database Insights & Auto-Profiling</h2>
        <p className="text-[#8b949e] text-xs mt-1">
          Perform automated structural decoding, inspect multi-domain telemetry logs (BMS, CMS, Water, EMS), and view dynamic integrity audits.
        </p>
      </div>

      {/* Domain Pattern Inference Dashboard */}
      {emsSummary?.detected && (
        <div className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#30363d] pb-4 gap-4">
            <div>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded">
                🧠 Decoded Multi-Domain Industrial Schema
              </span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide mt-3">Active Database Schema Audit</h3>
              <p className="text-xs text-[#8b949e] mt-1">
                The database manager crawled the relational catalog to deduce active industrial systems and transaction logs.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-mono bg-[#0d1117] border border-[#30363d] px-3 py-1.5 rounded text-slate-300">
              <span className="text-[#8b949e]">Database Type:</span>
              <span className="text-blue-400 font-bold">{emsSummary.dbType}</span>
            </div>
          </div>

          {/* Database Object Counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded text-center">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Active Domains</span>
              <div className="text-base font-bold text-slate-200 mt-1 font-mono">{emsSummary.detectedDomains.length}</div>
            </div>
            <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded text-center">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Tables Registry</span>
              <div className="text-base font-bold text-slate-200 mt-1 font-mono">{emsSummary.tablesCount}</div>
            </div>
            <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded text-center">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Views Compiled</span>
              <div className="text-base font-bold text-slate-200 mt-1 font-mono">{emsSummary.viewsCount}</div>
            </div>
            <div className="bg-[#0d1117] border border-[#30363d] p-4 rounded text-center">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Records</span>
              <div className="text-base font-bold text-blue-400 mt-1 font-mono">{emsSummary.totalRecords.toLocaleString()}</div>
            </div>
          </div>

          {/* Bento Grid for Decoded Domains */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#8b949e] uppercase tracking-widest font-mono">Decoded Industrial Domains</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {emsSummary.domainInsights.map((insight, idx) => {
                // Map icons dynamically
                let Icon = Activity;
                if (insight.domain.includes('BMS') || insight.domain.includes('Building')) Icon = Grid;
                if (insight.domain.includes('CMS') || insight.domain.includes('Chiller') || insight.domain.includes('Compressor')) Icon = Cpu;
                if (insight.domain.includes('Water')) Icon = Layers;
                if (insight.domain.includes('Historian') || insight.domain.includes('Power')) Icon = LineChart;

                return (
                  <div key={idx} className="bg-[#0d1117] border border-[#30363d] p-5 rounded flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-[#21262d] rounded border border-[#30363d] text-blue-400">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-sm text-slate-200 uppercase tracking-wide">{insight.domain}</span>
                        </div>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                          {insight.recordCount.toLocaleString()} Rows
                        </span>
                      </div>
                      <p className="text-xs text-[#8b949e] leading-relaxed">{insight.description}</p>
                    </div>

                    <div className="pt-3 border-t border-[#30363d] space-y-2">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[9px] font-mono text-[#8b949e] uppercase font-bold">Tables:</span>
                        {insight.tables.map((tbl) => (
                          <span key={tbl} className="text-[9px] font-mono bg-[#161b22] border border-[#30363d] text-slate-300 px-1.5 py-0.5 rounded font-bold">
                            {tbl}
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] font-mono text-blue-400 bg-blue-500/5 border border-blue-500/10 p-2.5 rounded leading-relaxed">
                        <span className="font-bold uppercase text-[9px] block text-blue-500 tracking-wider mb-0.5">💡 Key Observation:</span>
                        {insight.keyObservation}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic System Anomalies */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded flex items-start space-x-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-400 block mb-1">System Audit Anomalies & Guardrail Logs</span>
              <ul className="list-disc pl-4 space-y-1 text-slate-300 leading-relaxed">
                {emsSummary.anomalies.map((anom, idx) => <li key={idx}>{anom}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Profiler Workstation */}
      <div className="bg-[#161b22] border border-[#30363d] rounded shadow-xs overflow-hidden">
        {/* Header toolbar */}
        <div className="px-6 py-4 bg-[#161b22] border-b border-[#30363d] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-5 w-5 text-[#8b949e]" />
            <div>
              <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide">Table Data Profiler & Grid Preview</h3>
              <p className="text-xs text-slate-500 mt-1">Select any target dataset to analyze standard ranges, null records, and value cardinality.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-start">
            <select
              id="select_profile_table"
              value={targetTable}
              onChange={(e) => {
                setTargetTable(e.target.value);
                triggerProfile(e.target.value);
              }}
              className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs text-slate-300 font-mono font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="" disabled>-- Choose Table --</option>
              {schema?.tables.map((t) => (
                <option key={t.name} value={t.name}>{t.name} (Table)</option>
              ))}
              {schema?.views.map((v) => (
                <option key={v.name} value={v.name}>{v.name} (View)</option>
              ))}
            </select>

            <div className="bg-[#0d1117] border border-[#30363d] p-0.5 rounded flex">
              <button
                type="button"
                onClick={() => setActiveSubTab('profiler')}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${activeSubTab === 'profiler' ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-xs font-bold' : 'text-[#8b949e] hover:text-slate-300'}`}
              >
                Data Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('sample')}
                className={`px-3 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${activeSubTab === 'sample' ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-xs font-bold' : 'text-[#8b949e] hover:text-slate-300'}`}
              >
                Sample Rows
              </button>
            </div>
          </div>
        </div>

        {/* Content Panel */}
        <div className="p-6">
          {profiling ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <p className="text-slate-500 text-xs font-mono">Analyzing columns, calculating distinct elements, and auditing data integrity rules...</p>
            </div>
          ) : activeSubTab === 'profiler' ? (
            profileResult && (
              <div className="space-y-6">
                {/* Meta details banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border border-[#30363d] rounded bg-[#0d1117]">
                    <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider block mb-1 font-mono">Row Count</span>
                    <span className="font-mono text-base font-bold text-slate-200">{profileResult.rowCount.toLocaleString()}</span>
                  </div>
                  <div className="p-4 border border-[#30363d] rounded bg-[#0d1117]">
                    <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider block mb-1 font-mono">Inferred Pattern Context</span>
                    <span className="text-xs font-semibold text-blue-400 block mt-1 leading-normal font-sans">
                      {profileResult.inferredPattern?.description || 'General Relational Table'}
                    </span>
                  </div>
                  <div className="p-4 border border-[#30363d] rounded bg-[#0d1117]">
                    <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider block mb-1 font-mono">Warnings Detected</span>
                    <span className="text-xs font-semibold text-rose-400 block mt-1 font-mono">
                      {profileResult.anomalies.filter(a => !a.includes('No immediate')).length} warnings
                    </span>
                  </div>
                </div>

                {/* Columns metrics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#8b949e] uppercase tracking-widest font-mono">Column Profiling Metrics</h4>
                  <div className="overflow-x-auto border border-[#30363d] rounded bg-[#0d1117]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#161b22] border-b border-[#30363d] text-[#8b949e] font-mono">
                          <th className="px-4 py-3 font-semibold">Column</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Nulls</th>
                          <th className="px-4 py-3 font-semibold">Distincts</th>
                          <th className="px-4 py-3 font-semibold">Value Bounds (Min / Max)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#30363d] text-[#c9d1d9] font-mono text-[11px]">
                        {profileResult.columns.map((col, idx) => (
                          <tr key={idx} className="hover:bg-[#161b22]/50">
                            <td className="px-4 py-3 font-bold text-slate-200">{col.name}</td>
                            <td className="px-4 py-3 text-blue-400">{col.type}</td>
                            <td className="px-4 py-3">
                              <span className={col.nullCount > 0 ? 'text-rose-400 font-semibold' : 'text-slate-500'}>
                                {col.nullCount} ({col.nullPercentage}%)
                              </span>
                            </td>
                            <td className="px-4 py-3">{col.distinctCount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-[11px]">
                              {col.minVal !== null && col.minVal !== undefined ? (
                                <span className="bg-[#21262d] border border-[#30363d] px-1.5 py-0.5 rounded text-slate-300">
                                  Min: {col.minVal} | Max: {col.maxVal}
                                </span>
                              ) : (
                                <span className="text-slate-600">Non-numerical Bounds</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Specific Table anomalies */}
                <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded">
                  <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider block mb-1 font-mono">Schema Profile Warnings & Anomalies</span>
                  <div className="text-xs text-slate-400 space-y-1 mt-1 pl-1">
                    {profileResult.anomalies.map((anom, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-amber-500 font-bold shrink-0">⚠️</span>
                        <span>{anom}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Sample Data grid */
            <div className="space-y-4">
              {sampleError ? (
                <p className="text-xs text-rose-400">{sampleError}</p>
              ) : sampleData.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6 font-mono">No records returned for table preview.</p>
              ) : (
                <div className="overflow-x-auto border border-[#30363d] rounded max-h-96 bg-[#0d1117]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-[#161b22] border-b border-[#30363d] text-[#8b949e] z-10 font-mono">
                      <tr>
                        {Object.keys(sampleData[0]).map((key) => (
                          <th key={key} className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30363d] text-[#c9d1d9] font-mono text-[11px]">
                      {sampleData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#161b22]/50">
                          {Object.values(row).map((val: any, colIdx) => (
                            <td key={colIdx} className="px-4 py-2.5 truncate max-w-48" title={String(val)}>
                              {val === null || val === undefined ? (
                                <span className="text-slate-600 italic">NULL</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
