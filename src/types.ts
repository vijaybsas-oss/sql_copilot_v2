/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DBType = 'sqlite' | 'sqlserver' | 'postgres' | 'mysql' | 'postgresql' | 'mssql';

export interface ConnectionInfo {
  dbType: DBType;
  host: string;
  port: number;
  databaseName: string;
  username?: string;
  password?: string;
  isDemo?: boolean;
  isSimulated?: boolean;
  authType?: 'sql' | 'windows';
  domain?: string;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary: boolean;
  isForeign: boolean;
  foreignTable?: string;
  foreignColumn?: string;
}

export interface TableInfo {
  name: string;
  schema: string;
  columns: TableColumn[];
  rowCount: number;
  indexes?: string[];
}

export interface ViewInfo {
  name: string;
  schema: string;
  definition: string;
  columns: string[];
  sourceObjects: string[];
}

export interface ProcedureInfo {
  name: string;
  schema: string;
  definition: string;
  parameters: Array<{ name: string; type: string }>;
}

export interface SchemaMetadata {
  tables: TableInfo[];
  views: ViewInfo[];
  procedures: ProcedureInfo[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'table' | 'view' | 'procedure';
  schema: string;
}

export interface DependencyLink {
  source: string;
  target: string;
  type: 'fk' | 'reference';
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  links: DependencyLink[];
}

export interface ProfileResult {
  tableName: string;
  rowCount: number;
  columns: Array<{
    name: string;
    type: string;
    nullCount: number;
    nullPercentage: number;
    distinctCount: number;
    minVal?: string | number | null;
    maxVal?: string | number | null;
  }>;
  anomalies: string[];
  inferredPattern?: {
    isMeterMaster?: boolean;
    isTimeSeriesLog?: boolean;
    description: string;
  };
}

export interface DbSummary {
  detected: boolean;
  dbType: string;
  tablesCount: number;
  viewsCount: number;
  proceduresCount: number;
  detectedDomains: string[];
  domainInsights: Array<{
    domain: string;
    description: string;
    tables: string[];
    recordCount: number;
    keyObservation: string;
  }>;
  anomalies: string[];
  totalRecords: number;
}

export type EmsSummary = DbSummary; // Keep alias for backwards compatibility if needed

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sqlProposal?: {
    sql: string;
    explanation: string;
    affectedObjects: string[];
    estimatedImpact: string;
    isDdl: boolean;
    approved?: boolean;
  };
}

export interface ApprovalItem {
  id: string;
  sqlText: string;
  summary: string;
  affectedObjects: string[];
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  timestamp: string;
  result?: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: string; // Cron or simple interval
  action: 'procedure' | 'sql';
  actionValue: string; // Name of procedure or raw SQL
  active: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'failed';
  lastResult?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  query: string;
  mode: string;
  user: string;
  status: 'success' | 'failed';
  resultSummary: string;
}

export interface DbContextItem {
  id: string;
  domainName: string;
  businessRules: string;
  relationships: string;
  conventions: string;
}

export interface DictionaryEntry {
  id: string;
  tableName: string;
  columnName: string;
  displayName: string;
  description: string;
}

export interface QueryAnalysisResult {
  explanation: string;
  operationType: string;
  retrievedTables: string[];
  filteredColumns: string[];
  stepByStep: string[];
}

export interface DependencyAuditWarning {
  type: 'info' | 'warning' | 'danger';
  message: string;
  detail: string;
  tables: string[];
}

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

