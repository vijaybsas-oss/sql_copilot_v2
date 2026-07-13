/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Key, Globe, RefreshCw, CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import { AiSettings, ProviderConfig } from '../types';

export default function ModelSettingsPanel() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [modelList, setModelList] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/ai-settings')
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
        // Pre-fetch models for the loaded provider
        if (data && data.activeProvider) {
          loadModelsForProvider(data.activeProvider, data[data.activeProvider]);
        }
      })
      .catch((err) => {
        console.error('Failed to load AI settings:', err);
        setLoading(false);
      });
  }, []);

  const loadModelsForProvider = async (provider: string, config: ProviderConfig) => {
    try {
      const res = await fetch('/api/ai-settings/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.models) {
          setModelList(data.models);
        }
      }
    } catch (err) {
      console.error('Failed to load models for provider:', err);
    }
  };

  const handleProviderChange = (provider: 'gemini' | 'nim' | 'ollama' | 'lmstudio') => {
    if (!settings) return;
    const updated = { ...settings, activeProvider: provider };
    setSettings(updated);
    setFeedback(null);
    loadModelsForProvider(provider, updated[provider]);
  };

  const handleFieldChange = (
    provider: 'gemini' | 'nim' | 'ollama' | 'lmstudio',
    field: keyof ProviderConfig,
    value: any
  ) => {
    if (!settings) return;
    const providerConfig = { ...settings[provider], [field]: value };
    const updated = { ...settings, [provider]: providerConfig };
    setSettings(updated);
    setFeedback(null);
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSettings(data.settings);
          setFeedback({ success: true, message: 'AI Model Provider settings successfully saved.' });
        } else {
          setFeedback({ success: false, message: 'Failed to save settings.' });
        }
      } else {
        setFeedback({ success: false, message: `Server error: ${res.statusText}` });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!settings) return;
    setTesting(true);
    setFeedback(null);
    const provider = settings.activeProvider;
    const config = settings[provider];
    try {
      const res = await fetch('/api/ai-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config }),
      });
      const data = await res.json();
      setFeedback({ success: data.success, message: data.message });
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const fetchModelsFromServer = async () => {
    if (!settings) return;
    setFetchingModels(true);
    const provider = settings.activeProvider;
    const config = settings[provider];
    try {
      const res = await fetch('/api/ai-settings/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.models) {
          setModelList(data.models);
          if (data.models.length > 0 && !data.models.includes(config.model)) {
            // Suggest first available model
            handleFieldChange(provider, 'model', data.models[0]);
          }
          setFeedback({ success: true, message: `Successfully fetched ${data.models.length} available models from host.` });
        } else {
          setFeedback({ success: false, message: 'Could not fetch models. Check endpoint configurations.' });
        }
      } else {
        setFeedback({ success: false, message: 'Host server returned error fetching models.' });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error fetching models.' });
    } finally {
      setFetchingModels(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-6 flex items-center justify-center space-x-3 text-slate-400 text-xs">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
        <span>Loading AI Provider Configurations...</span>
      </div>
    );
  }

  const activeProvider = settings.activeProvider;
  const config = settings[activeProvider];

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded p-6 shadow-xs space-y-6">
      <div>
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center space-x-2">
          <Cpu className="h-4 w-4 text-emerald-400" />
          <span>System Settings: AI Model Provider</span>
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">
          Select and configure the large language model backend used for SQL generation, natural language orchestration, query translation, and schema debugging.
        </p>
      </div>

      {/* Provider Selector Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#0b0e14] p-1 rounded border border-[#1e293b]">
        {(['gemini', 'nim', 'ollama', 'lmstudio'] as const).map((prov) => {
          const isSelected = activeProvider === prov;
          const labelMap = {
            gemini: 'Google Gemini',
            nim: 'NVIDIA NIM',
            ollama: 'Ollama (Local)',
            lmstudio: 'LM Studio'
          };
          return (
            <button
              key={prov}
              type="button"
              id={`btn_ai_provider_${prov}`}
              onClick={() => handleProviderChange(prov)}
              className={`py-2 px-3 text-xs font-semibold rounded text-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {labelMap[prov]}
            </button>
          );
        })}
      </div>

      {/* Selected Provider Form Fields */}
      <div className="bg-[#0b0e14] border border-[#1e293b] rounded p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide font-mono">
            {activeProvider === 'gemini' && 'Google Gemini Configuration'}
            {activeProvider === 'nim' && 'NVIDIA NIM (OpenAI Compatible)'}
            {activeProvider === 'ollama' && 'Ollama Local Integration'}
            {activeProvider === 'lmstudio' && 'LM Studio Integration'}
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">
            Mode: {activeProvider === 'gemini' || activeProvider === 'nim' ? 'Cloud Ingress' : 'Local Ingress'}
          </span>
        </div>

        {/* Base URL (For NIM, Ollama, LM Studio) */}
        {activeProvider !== 'gemini' && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Globe className="h-3 w-3 text-slate-500" />
              <span>Base URL</span>
            </label>
            <input
              type="text"
              value={config.baseUrl || ''}
              onChange={(e) => handleFieldChange(activeProvider, 'baseUrl', e.target.value)}
              className="w-full bg-[#070a0f] border border-[#1e293b] rounded text-slate-100 px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500/80"
              placeholder={
                activeProvider === 'nim'
                  ? 'https://integrate.api.nvidia.com/v1'
                  : activeProvider === 'ollama'
                  ? 'http://localhost:11434'
                  : 'http://localhost:1234/v1'
              }
            />
          </div>
        )}

        {/* API Key (For Gemini, NIM) */}
        {(activeProvider === 'gemini' || activeProvider === 'nim') && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Key className="h-3 w-3 text-slate-500" />
              <span>API Key</span>
            </label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={(e) => handleFieldChange(activeProvider, 'apiKey', e.target.value)}
              className="w-full bg-[#070a0f] border border-[#1e293b] rounded text-slate-100 px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500/80"
              placeholder={config.apiKey === '••••••••' ? '••••••••' : 'Enter your private provider key'}
            />
            <span className="text-[10px] text-slate-500 block">
              {activeProvider === 'gemini' 
                ? 'Defaults to the server-side environment GEMINI_API_KEY if left empty.' 
                : 'Defaults to the server-side environment NVIDIA_API_KEY if left empty.'}
            </span>
          </div>
        )}

        {/* Model Selection Row (With dynamic Fetch button) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Target Model Name</label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  list="ai-models-list"
                  value={config.model}
                  onChange={(e) => handleFieldChange(activeProvider, 'model', e.target.value)}
                  className="w-full bg-[#070a0f] border border-[#1e293b] rounded text-slate-100 px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500/80"
                  placeholder="e.g. gemini-3.5-flash or meta/llama-3.3-70b-instruct"
                />
                <datalist id="ai-models-list">
                  {modelList.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={fetchModelsFromServer}
                disabled={fetchingModels}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 rounded text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer text-slate-300"
                title="Fetch models from server"
              >
                {fetchingModels ? (
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">Fetch</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Temperature</label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.1"
                value={config.temperature}
                onChange={(e) => handleFieldChange(activeProvider, 'temperature', parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
                {config.temperature.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Advanced Model Parameters Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Max Output Tokens</label>
            <input
              type="number"
              value={config.max_tokens}
              onChange={(e) => handleFieldChange(activeProvider, 'max_tokens', parseInt(e.target.value) || 2048)}
              className="w-full bg-[#070a0f] border border-[#1e293b] rounded text-slate-100 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500/80"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Top P</label>
            <input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={config.top_p ?? 0.9}
              onChange={(e) => handleFieldChange(activeProvider, 'top_p', parseFloat(e.target.value) || 0.9)}
              className="w-full bg-[#070a0f] border border-[#1e293b] rounded text-slate-100 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500/80"
            />
          </div>

          {activeProvider === 'gemini' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Top K</label>
              <input
                type="number"
                value={config.top_k ?? 40}
                onChange={(e) => handleFieldChange(activeProvider, 'top_k', parseInt(e.target.value) || 40)}
                className="w-full bg-[#070a0f] border border-[#1e293b] rounded text-slate-100 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500/80"
              />
            </div>
          )}
        </div>
      </div>

      {/* Feedback Alert Row */}
      {feedback && (
        <div className={`p-4 rounded border flex items-start space-x-3 ${
          feedback.success 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {feedback.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed">
            <span className="font-bold block mb-0.5">{feedback.success ? 'Action Complete' : 'Operation Alert'}</span>
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Action Trigger Row */}
      <div className="flex space-x-3 pt-2">
        <button
          type="button"
          onClick={testConnection}
          disabled={testing || saving || fetchingModels}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded text-xs font-semibold transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>Test Provider Connection</span>
        </button>
        <button
          type="button"
          onClick={saveSettings}
          disabled={testing || saving || fetchingModels}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded text-xs font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-50 shadow-lg shadow-emerald-950/20 cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>Save Provider Settings</span>
        </button>
      </div>
    </div>
  );
}
