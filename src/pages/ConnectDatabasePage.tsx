/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, ShieldAlert, CheckCircle2, Play, AlertCircle, Loader2, ChevronDown, Server, Monitor, Search, RotateCw } from 'lucide-react';
import { ConnectionInfo, DBType } from '../types';
import { api } from '../api/client';
import ModelSettingsPanel from '../components/ModelSettingsPanel';

interface ConnectDatabasePageProps {
  onConnected: (info: ConnectionInfo) => void;
  onApplied: (info: ConnectionInfo) => void;
  connectionInfo: ConnectionInfo | null;
  setHasUnsavedChanges: (dirty: boolean) => void;
}

export default function ConnectDatabasePage({ onConnected, onApplied, connectionInfo, setHasUnsavedChanges }: ConnectDatabasePageProps) {
  const [dbType, setDbType] = useState<DBType>('sqlite');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(1433);
  const [databaseName, setDatabaseName] = useState('');
  const [username, setUsername] = useState('sa');
  const [password, setPassword] = useState('');
  const [authType, setAuthType] = useState<'sql' | 'windows'>('sql');
  const [hasHandshaked, setHasHandshaked] = useState(false);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [showServerList, setShowServerList] = useState(false);
  const [showDbList, setShowDbList] = useState(false);
  
  const [customServers, setCustomServers] = useState<Array<{ name: string; type: string; desc: string }>>([]);
  const [scanningServers, setScanningServers] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [showScanConsole, setShowScanConsole] = useState(false);

  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Pre-populate the form fields with existing connectionInfo values on load or update
  useEffect(() => {
    if (connectionInfo) {
      setDbType(connectionInfo.dbType);
      if (connectionInfo.isDemo) {
        setDatabaseName('EMS Demonstration Sandbox');
        setHasHandshaked(true);
        setAvailableDatabases(['EMS Demonstration Sandbox']);
      } else {
        setHost(connectionInfo.host || '127.0.0.1');
        setPort(connectionInfo.port || 1433);
        setDatabaseName(connectionInfo.databaseName || '');
        setUsername(connectionInfo.username || 'sa');
        setPassword(connectionInfo.password || '');
        setAuthType(connectionInfo.authType || 'sql');
        if (connectionInfo.databaseName) {
          setHasHandshaked(true);
          setAvailableDatabases([connectionInfo.databaseName]);
        }
      }
    }
  }, [connectionInfo]);

  // Compare current form state with active connectionInfo to determine if changes are unsaved (dirty)
  useEffect(() => {
    if (!connectionInfo) {
      const changed = (
        dbType !== 'sqlite' ||
        host !== '127.0.0.1' ||
        port !== 1433 ||
        databaseName !== '' ||
        username !== 'sa' ||
        password !== '' ||
        authType !== 'sql'
      );
      setHasUnsavedChanges(changed);
    } else {
      if (connectionInfo.isDemo) {
        const changed = (
          dbType !== 'sqlite' ||
          databaseName !== 'EMS Demonstration Sandbox'
        );
        setHasUnsavedChanges(changed);
      } else {
        const changed = (
          dbType !== connectionInfo.dbType ||
          host !== (connectionInfo.host || '') ||
          port !== (connectionInfo.port || 0) ||
          databaseName !== (connectionInfo.databaseName || '') ||
          username !== (connectionInfo.username || '') ||
          password !== (connectionInfo.password || '') ||
          authType !== (connectionInfo.authType || 'sql')
        );
        setHasUnsavedChanges(changed);
      }
    }
  }, [dbType, host, port, databaseName, username, password, authType, connectionInfo, setHasUnsavedChanges]);

  const serverOptions = [
    { name: 'localhost', type: 'local', desc: 'Local Database Server' },
    { name: '127.0.0.1', type: 'local', desc: 'IPv4 Loopback Address' },
    { name: 'LAPTOP-CK0M4VVH\\SQLEXPRESS2019', type: 'express', desc: 'MS SQL Server Express 2019' },
    { name: 'localhost\\SQLEXPRESS', type: 'express', desc: 'Default Local Named Instance' },
    { name: 'PLC_BACKUP_SERVER', type: 'network', desc: 'Industrial Automation PLC Host' },
    { name: '192.168.1.100', type: 'network', desc: 'Field Facility Controller Subnet' },
    ...customServers
  ];

  const handleScanNetwork = async () => {
    setScanningServers(true);
    setShowScanConsole(true);
    setScanLogs(['Initializing secure broadcast scanning interface...']);
    try {
      const finalResult = await api.scanNetworkServers();
      
      // Simulate real-time log append for visual pleasure and terminal-style feedback
      for (let i = 0; i < finalResult.logs.length; i++) {
        await new Promise(resolve => setTimeout(resolve, i === 0 ? 100 : 250));
        setScanLogs(prev => [...prev, finalResult.logs[i]]);
      }
      
      // Update custom servers with newly found ones
      const defaultNames = ['localhost', '127.0.0.1', 'LAPTOP-CK0M4VVH\\SQLEXPRESS2019', 'localhost\\SQLEXPRESS', 'PLC_BACKUP_SERVER', '192.168.1.100'];
      const uniqueNewServers = finalResult.servers.filter(
        ns => !defaultNames.includes(ns.name)
      );
      setCustomServers(uniqueNewServers);
    } catch (err: any) {
      setScanLogs(prev => [...prev, `[ERROR] Scan routine failed: ${err.message}`]);
    } finally {
      setScanningServers(false);
    }
  };

  const highlightText = (text: string, search: string) => {
    if (!search) return <span className="text-slate-300 font-mono">{text}</span>;
    const parts = text.split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span className="font-mono text-slate-300">
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-emerald-500/20 text-emerald-400 font-semibold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const filteredServers = serverOptions.filter(srv =>
    srv.name.toLowerCase().includes(host.toLowerCase())
  );

  const handleDbTypeChange = (type: DBType) => {
    setDbType(type);
    setHasHandshaked(false);
    setAvailableDatabases([]);
    if (type === 'sqlserver') {
      setPort(1433);
      setDatabaseName('');
    } else if (type === 'postgres') {
      setPort(5432);
      setDatabaseName('');
    } else if (type === 'mysql') {
      setPort(3306);
      setDatabaseName('');
    } else {
      setDatabaseName('./ems_demo.db');
      setHasHandshaked(true);
      setAvailableDatabases(['./ems_demo.db']);
    }
    setFeedback(null);
  };

  const testConnection = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const defaultDb = dbType === 'sqlserver' ? 'master' : dbType === 'postgres' ? 'postgres' : 'sys';
      const config: ConnectionInfo = { dbType, host, port, databaseName: databaseName || defaultDb, username, password, authType };
      const res = await api.testConnection(config);
      setFeedback({ success: res.success, message: res.message });
      if (res.success) {
        setHasHandshaked(true);
        if (res.databases && res.databases.length > 0) {
          setAvailableDatabases(res.databases);
          if (!databaseName) {
            setDatabaseName(res.databases[0]);
          }
        } else {
          setAvailableDatabases(databaseName ? [databaseName] : []);
        }
      } else {
        setHasHandshaked(false);
        setAvailableDatabases([]);
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Connection test failed.' });
      setHasHandshaked(false);
      setAvailableDatabases([]);
    } finally {
      setTesting(false);
    }
  };

  const refreshDatabases = async () => {
    if (testing) return;
    setTesting(true);
    setFeedback(null);
    try {
      const defaultDb = dbType === 'sqlserver' ? 'master' : dbType === 'postgres' ? 'postgres' : 'sys';
      const config: ConnectionInfo = { dbType, host, port, databaseName: defaultDb, username, password, authType };
      const res = await api.testConnection(config);
      if (res.success) {
        setHasHandshaked(true);
        if (res.databases && res.databases.length > 0) {
          setAvailableDatabases(res.databases);
          if (res.databases.length > 0 && !res.databases.includes(databaseName)) {
            setDatabaseName(res.databases[0]);
          }
          setFeedback({ success: true, message: 'Successfully discovered and refreshed databases list!' });
        } else {
          setFeedback({ success: true, message: 'Connected successfully, but no databases discovered.' });
        }
      } else {
        setFeedback({ success: false, message: res.message || 'Failed to refresh databases list.' });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Failed to refresh databases.' });
    } finally {
      setTesting(false);
    }
  };

  const connectDb = async (isDemo = false, shouldRedirect = true) => {
    setConnecting(true);
    setFeedback(null);
    try {
      const config: ConnectionInfo = isDemo 
        ? { dbType: 'sqlite', host: '', port: 0, databaseName: 'EMS Demonstration Sandbox', isDemo: true }
        : { dbType, host, port, databaseName, username, password, authType };
        
      const res = await api.connect(config);
      if (res.success) {
        const finalConfig = res.config || config;
        if (finalConfig.databaseName) {
          setDatabaseName(finalConfig.databaseName);
        }
        if (shouldRedirect) {
          onConnected(finalConfig);
        } else {
          onApplied(finalConfig);
        }
        setFeedback({ success: true, message: `${res.message} ${!shouldRedirect ? '(Connection Settings Saved & Applied)' : ''}` });
      } else {
        setFeedback({ success: false, message: res.message });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Failed to connect.' });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Database Connection Panel</h2>
        <p className="text-slate-400 text-xs mt-1">Configure your target relational engine credentials to initialize autonomous mapping and copilot operations.</p>
      </div>

      {/* Active Database Status Card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider block font-mono">Current Active Database Connection</span>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${connectionInfo ? (connectionInfo.isSimulated ? 'bg-amber-500' : 'bg-green-500 animate-pulse') : 'bg-red-500'}`}></span>
            <span className="text-sm font-bold text-slate-100 font-mono">
              {connectionInfo?.isDemo
                ? 'EMS Demonstration Sandbox (SQLite)'
                : connectionInfo
                ? `${connectionInfo.databaseName} (${connectionInfo.dbType.toUpperCase()}${connectionInfo.isSimulated ? ' - Simulated Sandbox' : ''})`
                : 'Disconnected: Handshake Pending'}
            </span>
            {connectionInfo && (
              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold ${
                connectionInfo.isSimulated 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                  : 'bg-green-500/10 text-green-400 border border-green-500/20'
              }`}>
                {connectionInfo.isSimulated ? 'Simulated Fallback' : 'Active Live'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#8b949e] leading-relaxed font-sans">
            {connectionInfo?.isDemo
              ? 'Using built-in sandbox loaded with 500+ records of hourly electricity logs, shift metrics, views, and index buffers.'
              : connectionInfo
              ? `Host: ${connectionInfo.host || 'localhost'} | Port: ${connectionInfo.port || 'default'} | User: ${connectionInfo.username || 'N/A'} | Database: ${connectionInfo.databaseName}`
              : 'Configure access credentials below to mount your target database.'}
          </p>
        </div>
        
        {connectionInfo && !connectionInfo.isDemo && (
          <button
            type="button"
            onClick={() => connectDb(true)}
            disabled={connecting}
            className="bg-[#21262d] hover:bg-rose-950/20 hover:text-rose-400 hover:border-rose-500/30 text-slate-400 border border-[#30363d] px-4 py-2.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Reset to Demo Sandbox</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Form Column */}
        <div id="connect-database-form" className="lg:col-span-2 space-y-6">
          {/* Dialect Selector */}
          <div className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">1. Select Target Database Engine</h3>
              {connectionInfo && (dbType !== connectionInfo.dbType || (connectionInfo.isDemo && dbType !== 'sqlite')) && (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono">
                  Draft Configuration Selected
                </span>
              )}
            </div>

            {connectionInfo && (dbType !== connectionInfo.dbType || (connectionInfo.isDemo && dbType !== 'sqlite')) && (
              <div className="bg-amber-950/25 border border-amber-500/20 rounded p-4 text-xs flex items-start gap-2.5 text-amber-200">
                <span className="text-amber-500 font-bold">💡 Draft Configuration Mode:</span>
                <p className="text-[11px] leading-relaxed">
                  You are viewing/editing settings for <strong className="text-amber-400 capitalize">{dbType}</strong>, but the active database is currently 
                  <strong className="text-amber-400"> {connectionInfo.isDemo ? 'EMS Demonstration Sandbox (SQLite)' : connectionInfo.databaseName} ({connectionInfo.dbType.toUpperCase()})</strong>.
                  Your changes will only take effect and switch the active database once you click <strong>Establish Connection</strong> below.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'sqlite', label: 'SQLite', desc: 'Local Database file' },
                { id: 'sqlserver', label: 'SQL Server', desc: 'Express / Developer' },
                { id: 'postgres', label: 'PostgreSQL', desc: 'Relational DB' },
                { id: 'mysql', label: 'MySQL / MariaDB', desc: 'Relational DB' },
              ].map((engine) => {
                const isSelected = dbType === engine.id;
                return (
                  <button
                    key={engine.id}
                    id={`btn_dialect_${engine.id}`}
                    type="button"
                    onClick={() => handleDbTypeChange(engine.id as DBType)}
                    className={`text-left p-4 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30 text-slate-100'
                        : 'border-[#30363d] hover:border-[#8b949e] bg-[#0d1117] text-slate-400'
                    }`}
                  >
                    <Database className={`h-4 w-4 mb-2 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="font-bold text-xs block">{engine.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{engine.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Credentials Form */}
          <div className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">2. Enter Access Credentials</h3>
              <span className="text-[10px] text-slate-400 bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded font-mono">SSMS Configuration Mapper</span>
            </div>

            {/* SSMS Alignment Tip Box */}
            <div className="bg-[#0d1117] border border-[#30363d] rounded p-4 text-xs space-y-2.5">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="text-blue-400">💡</span> How to map your SSMS Settings:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[#8b949e]">
                <div className="space-y-1">
                  <span className="text-slate-300 font-medium block">SSMS "Server name"</span>
                  <span className="block font-mono bg-[#161b22] p-1 rounded border border-[#30363d]">
                    ➔ Input as <strong className="text-blue-400">Hostname / Server Address</strong>
                  </span>
                  <span className="text-[10px] text-slate-500 italic">E.g., LAPTOP-CK0M4VVH\SQLEXPRESS2019 or localhost</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-300 font-medium block">SSMS "Authentication"</span>
                  <span className="block font-mono bg-[#161b22] p-1 rounded border border-[#30363d]">
                    ➔ Choose <strong className="text-blue-400">Windows Authentication</strong>
                  </span>
                  <span className="text-[10px] text-slate-500 italic">E.g., input LAPTOP-CK0M4VVH\vijay as username</span>
                </div>
              </div>
            </div>
            
            {dbType === 'sqlite' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Database File Path</label>
                <input
                  type="text"
                  value={databaseName}
                  onChange={(e) => setDatabaseName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500/80 transition-all"
                  placeholder="./my_database.db"
                />
                <span className="text-[10px] text-slate-500">Specifies the absolute or relative location of the SQLite schema file.</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Hostname / Server Address (Typable & Searchable Combobox with Active Subnet Broadcast) */}
                  <div className="space-y-1.5 relative">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 block">Hostname / Server Address</label>
                      <button
                        type="button"
                        onClick={handleScanNetwork}
                        disabled={scanningServers}
                        className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {scanningServers ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                            <span>Scanning Network...</span>
                          </>
                        ) : (
                          <>
                            <Search className="h-3 w-3" />
                            <span>Scan for Network Servers</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-[#8b949e]">
                        <Server className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => {
                          setHost(e.target.value);
                          setHasHandshaked(false);
                          setDatabaseName('');
                          setAvailableDatabases([]);
                        }}
                        onFocus={() => setShowServerList(true)}
                        onBlur={() => setTimeout(() => setShowServerList(false), 200)}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] pl-9 pr-10 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20 transition-all"
                        placeholder="E.g., LAPTOP-CK0M4VVH\SQLEXPRESS2019"
                      />
                      <button
                        type="button"
                        id="btn_server_dropdown"
                        onClick={() => setShowServerList(!showServerList)}
                        className="absolute right-0 h-full px-3 text-[#8b949e] hover:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showServerList ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    
                    {showServerList && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded shadow-2xl max-h-60 overflow-y-auto divide-y divide-[#30363d]/30">
                        {/* Search Indicator */}
                        {host && (
                          <div className="px-3.5 py-1.5 bg-[#0d1117]/50 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                            <span>Filtering by: "{host}"</span>
                            <span className="text-blue-400 font-semibold">{filteredServers.length} match(es)</span>
                          </div>
                        )}
                        
                        {filteredServers.length > 0 ? (
                          filteredServers.map((srv) => (
                            <button
                              key={srv.name}
                              type="button"
                              onMouseDown={() => {
                                setHost(srv.name);
                                setHasHandshaked(false);
                                setDatabaseName('');
                                setAvailableDatabases([]);
                                setShowServerList(false);
                              }}
                              className="w-full text-left px-3.5 py-2.5 hover:bg-[#21262d] hover:text-blue-400 transition-colors block text-xs group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {srv.type === 'local' ? (
                                    <Monitor className="h-3 w-3 text-slate-500 group-hover:text-blue-400" />
                                  ) : (
                                    <Server className="h-3 w-3 text-slate-500 group-hover:text-blue-400" />
                                  )}
                                  {highlightText(srv.name, host)}
                                </div>
                                <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono ${
                                  srv.type === 'local' 
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10' 
                                    : srv.type === 'express'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                                    : 'bg-green-500/10 text-green-400 border border-green-500/10'
                                }`}>
                                  {srv.type}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-0.5 pl-5 font-sans leading-normal">
                                {srv.desc}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3.5 py-3 text-center text-xs text-slate-500 font-sans">
                            No matching default servers. Press Tab/Enter to keep <span className="text-slate-300 font-mono">"{host}"</span>.
                          </div>
                        )}
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 block">Select from the searchable list (SSMS pattern) or type manually.</span>
                  </div>

                  {/* Port */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Connection Port</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => {
                        setPort(parseInt(e.target.value) || 0);
                        setHasHandshaked(false);
                        setDatabaseName('');
                        setAvailableDatabases([]);
                      }}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500/80 transition-all"
                    />
                  </div>

                  {/* Authentication Type Selector (Only for SQL Server) */}
                  {dbType === 'sqlserver' && (
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-300">Authentication Mode</label>
                      <select
                        value={authType}
                        onChange={(e) => {
                          const val = e.target.value as 'sql' | 'windows';
                          setAuthType(val);
                          setHasHandshaked(false);
                          setDatabaseName('');
                          setAvailableDatabases([]);
                          if (val === 'windows') {
                            setUsername('LAPTOP-CK0M4VVH\\vijay');
                          } else {
                            setUsername('sa');
                          }
                        }}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500/80 transition-all"
                      >
                        <option value="sql">SQL Server Authentication</option>
                        <option value="windows">Windows Authentication (Integrated Security / Trusted Connection)</option>
                      </select>
                      <span className="text-[10px] text-slate-500 block">
                        Choose Windows Authentication to leverage trusted SSPI/integrated domain credentials.
                      </span>
                    </div>
                  )}

                  {/* Live Subnet Broadcaster Diagnostic Console */}
                  {showScanConsole && (
                    <div className="md:col-span-2 bg-[#0d1117] border border-[#30363d] rounded p-4 font-mono text-[11px] space-y-2.5 shadow-inner transition-all">
                      <div className="flex items-center justify-between border-b border-[#30363d]/50 pb-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${scanningServers ? 'bg-blue-500 animate-pulse' : 'bg-slate-500'}`} />
                          <span className="text-slate-400 font-bold text-xs">NETWORK BROWSING DIAGNOSTIC TERMINAL</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowScanConsole(false)}
                          className="text-slate-500 hover:text-slate-300 text-xs focus:outline-none transition-colors cursor-pointer"
                        >
                          [Hide Terminal]
                        </button>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                        {scanLogs.map((log, index) => {
                          const isError = log.startsWith('[ERROR]');
                          return (
                            <div
                              key={index}
                              className={`${isError ? 'text-rose-400' : 'text-blue-400'} leading-relaxed`}
                            >
                              <span className="text-slate-600 select-none mr-2">❯</span>
                              {log}
                            </div>
                          );
                        })}
                        {scanningServers && (
                          <div className="text-blue-400 flex items-center gap-1.5 mt-1">
                            <span className="text-slate-600 mr-2">❯</span>
                            <span className="animate-pulse">Pinging subnet SQL Server gateways...</span>
                            <span className="inline-block w-1.5 h-3 bg-blue-400 ml-1 animate-pulse" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Explanation for Windows Authentication */}
                  {dbType === 'sqlserver' && authType === 'windows' && (
                    <div className="md:col-span-2 bg-blue-950/20 border border-blue-500/20 rounded p-4 text-xs space-y-2.5 text-blue-200">
                      <h4 className="font-bold flex items-center gap-1.5 text-blue-400">
                        <span>✓</span> Windows Integrated Security (Trusted Connection) Enabled
                      </h4>
                      <p className="text-[11px] leading-relaxed text-[#8b949e]">
                        Manual username and password fields have been disabled. The application will request a 
                        <strong> Trusted Connection (SSPI)</strong> from SQL Server, utilizing the system's logged-in Windows session 
                        credentials to establish authentications.
                      </p>
                      <div className="pt-2 space-y-1 text-[11px] border-t border-blue-500/20">
                        <span className="font-semibold text-blue-400">⚡ Cloud Sandbox Routing:</span>
                        <p className="text-[#8b949e] leading-normal">
                          A secure Virtual Integrated Tunnel has been prepared to handle loopbacks for local hosts (like <code className="bg-[#0d1117] border border-[#30363d] px-1 py-0.5 rounded text-blue-400 font-mono">localhost</code> or your laptops name). 
                          Connecting is simple and instantaneous.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Authentication Credentials (Only visible for SQL Auth) */}
                  {authType !== 'windows' && (
                    <>
                      {/* Authentication Username */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Authentication Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            setHasHandshaked(false);
                            setDatabaseName('');
                            setAvailableDatabases([]);
                          }}
                          className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500/80 transition-all"
                          placeholder="sa"
                        />
                      </div>

                      {/* Database Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Database Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setHasHandshaked(false);
                            setDatabaseName('');
                            setAvailableDatabases([]);
                          }}
                          className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500/80 transition-all"
                          placeholder="••••••••••••••"
                        />
                        <span className="text-[10px] text-slate-500 block">
                          The password of your SQL server login account.
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Connection Test (Handshake) Block (Placed BELOW authentication mode / credentials as requested) */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 font-mono">1. SYSTEM GATEWAY HANDSHAKE</h4>
                      <p className="text-[11px] text-slate-500">Establish handshake credentials to discover databases and discover schemas.</p>
                    </div>
                    <button
                      type="button"
                      id="btn_test_conn"
                      onClick={testConnection}
                      disabled={testing || connecting}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-4 py-2.5 rounded text-xs font-semibold transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                      <span>Test Handshake Connection</span>
                    </button>
                  </div>

                  {feedback && (
                    <div className={`p-3.5 rounded border flex items-start space-x-3 text-left ${
                      feedback.success 
                        ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                      {feedback.success ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
                      <div className="text-xs leading-relaxed">
                        <span className="font-bold block mb-0.5">{feedback.success ? 'Success' : 'Connection Failure'}</span>
                        <span>{feedback.message}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Database Name (Only active after successful connection handshake) */}
                <div className="space-y-1.5 relative">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-300 block">Database Name</label>
                    {hasHandshaked && (
                      <button
                        type="button"
                        onClick={refreshDatabases}
                        disabled={testing || connecting}
                        className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 focus:outline-none transition-colors cursor-pointer"
                      >
                        <RotateCw className={`h-3 w-3 ${testing ? 'animate-spin' : ''}`} />
                        <span>Refresh Available Databases</span>
                      </button>
                    )}
                  </div>

                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1 flex items-center">
                      <input
                        type="text"
                        value={databaseName}
                        onChange={(e) => setDatabaseName(e.target.value)}
                        disabled={!hasHandshaked}
                        onFocus={() => { if (hasHandshaked) setShowDbList(true); }}
                        onBlur={() => setTimeout(() => setShowDbList(false), 200)}
                        className={`w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] pl-3.5 pr-10 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500/80 transition-all ${
                          !hasHandshaked ? 'opacity-50 cursor-not-allowed border-[#30363d] text-slate-600' : ''
                        }`}
                        placeholder={hasHandshaked ? "Select or type database..." : "🔒 Test connection handshake to unlock..."}
                      />
                      {hasHandshaked && availableDatabases.length > 0 && (
                        <button
                          type="button"
                          id="btn_db_dropdown"
                          onClick={() => setShowDbList(!showDbList)}
                          className="absolute right-0 h-full px-3 text-[#8b949e] hover:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showDbList ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {!hasHandshaked && (
                      <button
                        type="button"
                        onClick={testConnection}
                        disabled={testing || connecting}
                        className="bg-[#21262d] hover:bg-[#30363d] text-xs text-[#c9d1d9] border border-[#30363d] px-3 py-2.5 rounded font-semibold transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        <RotateCw className={`h-3 w-3 ${testing ? 'animate-spin' : ''}`} />
                        <span>Handshake First</span>
                      </button>
                    )}
                  </div>
                  
                  {showDbList && hasHandshaked && availableDatabases.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded shadow-2xl max-h-48 overflow-y-auto">
                      {availableDatabases.map((db) => (
                        <button
                          key={db}
                          type="button"
                          onMouseDown={() => {
                            setDatabaseName(db);
                            setShowDbList(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-mono text-[#c9d1d9] hover:bg-[#21262d] hover:text-blue-400 transition-colors block border-b border-[#30363d]/30 last:border-0"
                        >
                          {db}
                        </button>
                      ))}
                    </div>
                  )}

                  {!hasHandshaked ? (
                    <span className="text-[10px] text-amber-500 flex items-center gap-1">
                      <span>⚠️</span> Available database names will dynamically load after a successful connection handshake.
                    </span>
                  ) : (
                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                      <span>✓</span> Successfully discovered {availableDatabases.length} databases. Choose from the dropdown list or type manually.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                id="btn_conn_apply"
                onClick={() => connectDb(false, false)}
                disabled={testing || connecting || (dbType !== 'sqlite' && !databaseName)}
                className="flex-1 bg-[#21262d] hover:bg-[#30363d] text-blue-400 border border-[#30363d] px-4 py-2.5 rounded text-xs font-semibold transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-blue-400" />}
                <span>Apply Connection Settings</span>
              </button>

              <button
                type="button"
                id="btn_conn_save"
                onClick={() => connectDb(false, true)}
                disabled={testing || connecting || (dbType !== 'sqlite' && !databaseName)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded text-xs font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-50 shadow-lg shadow-blue-950/20 cursor-pointer"
              >
                {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                <span>Establish Connection</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Help Column */}
        <div className="space-y-6">
          {/* Quick Sandbox Launcher Card */}
          <div className="bg-gradient-to-br from-[#161b22] to-[#0d1117] border border-[#30363d] rounded p-6 shadow-md relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-5">
              <Database className="h-48 w-48 text-blue-400" />
            </div>
            
            <div className="relative z-10 space-y-4">
              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                💡 Zero Setup Demo
              </span>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">Energy Management Sandbox</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Test-drive the full database copilot using an intelligent local SQLite database pre-seeded with 500+ records of hourly kWh meter logs, shift aggregations, views, and index metrics!
                </p>
              </div>
              <button
                type="button"
                id="btn_launch_demo"
                onClick={() => connectDb(true)}
                disabled={connecting}
                className="w-full bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-blue-400 font-bold px-4 py-2.5 rounded text-xs transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
              >
                <Play className="h-3 w-3 text-blue-400 fill-blue-400/30" />
                <span>Launch EMS Sandbox</span>
              </button>
            </div>
          </div>

          {/* Security and Cloud Run Container Guardrails */}
          <div className="bg-[#161b22] border border-[#30363d] rounded p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 text-slate-200">
              <ShieldAlert className="h-4 w-4 text-[#8b949e]" />
              <h4 className="font-bold text-xs uppercase tracking-wider font-mono">Sandbox Architecture</h4>
            </div>
            <ul className="text-[11px] text-[#8b949e] space-y-2.5 list-disc pl-4 leading-relaxed">
              <li>This application resides in a secure serverless cloud sandbox.</li>
              <li>External database servers (e.g. your local MS SQL Server Express) must be accessible over public IPs with open ingress ports (e.g., 1433), or we suggest using the **Local Sandbox**.</li>
              <li>Every write action plan generates standard SQL which is fully logged inside our auditing engine.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Model Settings Panel */}
      <ModelSettingsPanel />
    </div>
  );
}
