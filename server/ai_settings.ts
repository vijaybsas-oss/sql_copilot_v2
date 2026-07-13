/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

export interface ProviderConfig {
  model: string;
  max_tokens: number;
  temperature: number;
  top_p?: number;
  top_k?: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface AiSettings {
  activeProvider: 'gemini' | 'nim' | 'ollama' | 'lmstudio';
  gemini: ProviderConfig;
  nim: ProviderConfig;
  ollama: ProviderConfig;
  lmstudio: ProviderConfig;
}

const CONFIG_PATH = path.join(process.cwd(), 'ai_config.json');

const DEFAULT_SETTINGS: AiSettings = {
  activeProvider: 'gemini',
  gemini: {
    model: 'gemini-3.5-flash',
    apiKey: '',
    max_tokens: 2048,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40
  },
  nim: {
    model: 'meta/llama-3.3-70b-instruct',
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    max_tokens: 2048,
    temperature: 0.7,
    top_p: 0.9
  },
  ollama: {
    model: 'llama3.1',
    baseUrl: 'http://localhost:11434',
    max_tokens: 2048,
    temperature: 0.7,
    top_p: 0.9
  },
  lmstudio: {
    model: 'meta-llama-3-8b-instruct',
    baseUrl: 'http://localhost:1234/v1',
    max_tokens: 2048,
    temperature: 0.7,
    top_p: 0.9
  }
};

class AiSettingsManager {
  private settings: AiSettings;

  constructor() {
    this.settings = this.loadFromFile();
  }

  private loadFromFile(): AiSettings {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        // Deep merge with defaults to ensure all keys exist
        return {
          activeProvider: parsed.activeProvider || DEFAULT_SETTINGS.activeProvider,
          gemini: { ...DEFAULT_SETTINGS.gemini, ...parsed.gemini },
          nim: { ...DEFAULT_SETTINGS.nim, ...parsed.nim },
          ollama: { ...DEFAULT_SETTINGS.ollama, ...parsed.ollama },
          lmstudio: { ...DEFAULT_SETTINGS.lmstudio, ...parsed.lmstudio }
        };
      }
    } catch (err) {
      console.error('Failed to load ai_config.json, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public getSettings(): AiSettings {
    return this.settings;
  }

  /**
   * Returns settings with redacted sensitive keys for safe client transfer.
   */
  public getRedactedSettings(): AiSettings {
    const copy = JSON.parse(JSON.stringify(this.settings));
    
    // Redact Gemini API key
    if (copy.gemini.apiKey) {
      copy.gemini.apiKey = '••••••••';
    } else if (process.env.GEMINI_API_KEY) {
      copy.gemini.apiKey = '••••••••'; // Show that env var key exists
    }
    
    // Redact NIM API key
    if (copy.nim.apiKey) {
      copy.nim.apiKey = '••••••••';
    } else if (process.env.NVIDIA_API_KEY) {
      copy.nim.apiKey = '••••••••';
    }

    return copy;
  }

  public saveSettings(newSettings: Partial<AiSettings>): void {
    if (newSettings.activeProvider) {
      this.settings.activeProvider = newSettings.activeProvider;
    }

    const providers: Array<'gemini' | 'nim' | 'ollama' | 'lmstudio'> = ['gemini', 'nim', 'ollama', 'lmstudio'];
    for (const provider of providers) {
      if (newSettings[provider]) {
        const incoming = newSettings[provider]!;
        const current = this.settings[provider];
        
        // If incoming key is redacted, keep current key
        let resolvedApiKey = incoming.apiKey;
        if (resolvedApiKey === '••••••••') {
          resolvedApiKey = current.apiKey;
        }

        this.settings[provider] = {
          ...current,
          ...incoming,
          apiKey: resolvedApiKey
        };
      }
    }

    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write ai_config.json:', err);
    }
  }

  public getActiveConfig(): ProviderConfig {
    const provider = this.settings.activeProvider;
    return this.settings[provider];
  }

  /**
   * Retrieves the API key for a provider, checking config first, then env variables.
   */
  public getApiKey(provider: 'gemini' | 'nim'): string {
    const config = this.settings[provider];
    if (config.apiKey && config.apiKey !== '••••••••') {
      return config.apiKey;
    }
    if (provider === 'gemini') {
      return process.env.GEMINI_API_KEY || '';
    }
    if (provider === 'nim') {
      return process.env.NVIDIA_API_KEY || '';
    }
    return '';
  }
}

export const aiSettingsManager = new AiSettingsManager();

export async function testProviderConnection(provider: string, config: ProviderConfig): Promise<{ success: boolean; message: string }> {
  try {
    if (provider === 'gemini') {
      const key = config.apiKey === '••••••••' ? aiSettingsManager.getApiKey('gemini') : (config.apiKey || '');
      if (!key) {
        return { success: false, message: 'Gemini API key is required.' };
      }
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      // Just do a simple call
      const res = await ai.models.generateContent({
        model: config.model || 'gemini-3.5-flash',
        contents: 'Ping',
        config: { maxOutputTokens: 5 }
      });
      if (res.text) {
        return { success: true, message: 'Successfully connected to Google Gemini!' };
      }
      return { success: false, message: 'Gemini returned empty response.' };
    }

    // OpenAI compatible providers
    let baseUrl = config.baseUrl || '';
    let apiKey = '';
    if (provider === 'nim') {
      baseUrl = config.baseUrl || 'https://integrate.api.nvidia.com/v1';
      apiKey = config.apiKey === '••••••••' ? aiSettingsManager.getApiKey('nim') : (config.apiKey || '');
      if (!apiKey) {
        return { success: false, message: 'NVIDIA NIM API key is required.' };
      }
    } else if (provider === 'ollama') {
      baseUrl = config.baseUrl || 'http://localhost:11434';
      if (!baseUrl.endsWith('/v1') && !baseUrl.endsWith('/v1/')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
      }
    } else if (provider === 'lmstudio') {
      baseUrl = config.baseUrl || 'http://localhost:1234/v1';
    }

    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      return { success: true, message: `Successfully connected to ${provider.toUpperCase()}!` };
    } else {
      const err = await response.text();
      return { success: false, message: `Failed with status ${response.status}: ${err}` };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection error.' };
  }
}

export async function fetchProviderModels(provider: string, config: ProviderConfig): Promise<string[]> {
  try {
    if (provider === 'gemini') {
      // Return standard supported Gemini models
      return ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-2.5-flash'];
    }

    let baseUrl = config.baseUrl || '';
    let apiKey = '';
    if (provider === 'nim') {
      baseUrl = config.baseUrl || 'https://integrate.api.nvidia.com/v1';
      apiKey = config.apiKey === '••••••••' ? aiSettingsManager.getApiKey('nim') : (config.apiKey || '');
    } else if (provider === 'ollama') {
      baseUrl = config.baseUrl || 'http://localhost:11434';
    } else if (provider === 'lmstudio') {
      baseUrl = config.baseUrl || 'http://localhost:1234/v1';
    }

    // For Ollama, native list models endpoint is /api/tags
    if (provider === 'ollama') {
      try {
        const url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.models && Array.isArray(data.models)) {
            return data.models.map((m: any) => m.name);
          }
        }
      } catch (e: any) {
        console.warn(`[Ollama] Unable to contact local instance at ${baseUrl} via tags API: ${e.message}`);
      }
    }

    // Try standard OpenAI models endpoint GET /models
    let openaiBaseUrl = baseUrl;
    if (provider === 'ollama' && !openaiBaseUrl.endsWith('/v1') && !openaiBaseUrl.endsWith('/v1/')) {
      openaiBaseUrl = openaiBaseUrl.replace(/\/$/, '') + '/v1';
    }

    const url = `${openaiBaseUrl.replace(/\/$/, '')}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m: any) => m.id);
        }
      }
    } catch (e: any) {
      console.warn(`[AI Settings] Connection offline or unreachable for ${provider} at ${url}: ${e.message}`);
    }

    // Fallbacks if fetch fails
    if (provider === 'nim') {
      return ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'];
    }
    if (provider === 'ollama') {
      return ['llama3.1', 'codellama', 'gemma2', 'mistral'];
    }
    if (provider === 'lmstudio') {
      return ['meta-llama-3-8b-instruct', 'loaded-model-id'];
    }

    return [];
  } catch (err: any) {
    console.warn(`Failed to fetch models for ${provider} gracefully: ${err.message}`);
    // Return standard fallback lists
    if (provider === 'nim') {
      return ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'];
    }
    if (provider === 'ollama') {
      return ['llama3.1', 'codellama', 'gemma2', 'mistral'];
    }
    if (provider === 'lmstudio') {
      return ['meta-llama-3-8b-instruct', 'loaded-model-id'];
    }
    return [];
  }
}
