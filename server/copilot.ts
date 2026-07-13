/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { SchemaMetadata, DbContextItem, DictionaryEntry } from '../src/types';
import { aiSettingsManager } from './ai_settings';

// Centralised LLM Copilot Controller
export class SqlCopilot {
  private ai: GoogleGenAI | null = null;

  public dbContexts: DbContextItem[] = [
    {
      id: 'ctx_01',
      domainName: 'BMS (Building Management System)',
      businessRules: 'Temperature target range is 19.5°C to 25.5°C. Alert status is set to \'HIGH\' if carbon dioxide exceeds 750 ppm. Humidity should stay near 40% - 50% RH.',
      relationships: 'BmsLogs table maps back to BmsPoints table using the PointID foreign key.',
      conventions: 'Sensor metrics are logged as floating-point readings. Each physical sensor represents a unique point.'
    },
    {
      id: 'ctx_02',
      domainName: 'Water Flow Management',
      businessRules: 'Flow rates are measured in liters per second (Lps). Total volumes are accumulated in cubic meters (m³). Pipeline diameters are tracked in millimeters (mm).',
      relationships: 'WaterLogs table maps back to WaterSensors table using the SensorID foreign key.',
      conventions: 'Sensor intake metrics represent municipal boundary entries, cooling loop returns, or main process headers.'
    }
  ];

  public dictionaryEntries: DictionaryEntry[] = [
    {
      id: 'dic_01',
      tableName: 'BmsPoints',
      columnName: 'TargetValue',
      displayName: 'Thermostat Setting Temp',
      description: 'The target thermal threshold programmed for the localized environment.'
    },
    {
      id: 'dic_02',
      tableName: 'BmsLogs',
      columnName: 'Value',
      displayName: 'Telemetry Reading',
      description: 'The actual raw temperature, humidity, or CO2 quantity returned from the physical sensor.'
    },
    {
      id: 'dic_03',
      tableName: 'WaterLogs',
      columnName: 'FlowRateLps',
      displayName: 'Momentary Flow Rate (L/s)',
      description: 'The real-time velocity flow rate of water passing through the pipe node in Liters per second.'
    },
    {
      id: 'dic_04',
      tableName: 'WaterLogs',
      columnName: 'TotalVolumeM3',
      displayName: 'Cumulative Volumetric Load (m³)',
      description: 'The overall aggregated water consumption passing through the node, in cubic meters.'
    },
    {
      id: 'dic_05',
      tableName: 'CmsEquipment',
      columnName: 'RatedPowerKw',
      displayName: 'Max Power Rating (kW)',
      description: 'The maximum electrical wattage power configuration for heavy chiller compressor assets.'
    }
  ];

  constructor() {}

  private async executeLlmCall(prompt: string, responseSchema?: any): Promise<string> {
    const settings = aiSettingsManager.getSettings();
    const provider = settings.activeProvider;
    const config = settings[provider];

    if (provider === 'gemini') {
      const apiKey = aiSettingsManager.getApiKey('gemini');
      if (!apiKey) {
        throw new Error('Google Gemini API Key is missing. Please configure it in System Settings.');
      }
      
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: config.model || 'gemini-3.5-flash',
        contents: prompt,
        config: {
          temperature: config.temperature,
          maxOutputTokens: config.max_tokens,
          responseMimeType: responseSchema ? 'application/json' : undefined,
          responseSchema: responseSchema || undefined,
        },
      });

      return response.text || '';
    }

    // OpenAI-compatible providers: nim, ollama, lmstudio
    let baseUrl = config.baseUrl || '';
    let apiKey = '';
    
    if (provider === 'nim') {
      baseUrl = config.baseUrl || 'https://integrate.api.nvidia.com/v1';
      apiKey = aiSettingsManager.getApiKey('nim');
      if (!apiKey) {
        throw new Error('NVIDIA NIM API Key is missing. Please configure it in System Settings.');
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
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    console.log(`[LLM Request] Provider: ${provider}, Model: ${config.model}, Temp: ${config.temperature}`);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: config.temperature,
          max_tokens: config.max_tokens,
          top_p: config.top_p || 0.9,
          ...(responseSchema ? { response_format: { type: 'json_object' } } : {})
        })
      });
    } catch (e: any) {
      throw new Error(`Active provider ${provider} is offline or unreachable: ${e.message}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM provider ${provider} returned error status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Assembles a highly descriptive prompt incorporating the database state and schema
  private buildPrompt(schema: SchemaMetadata, userRequest: string): string {
    const tableDesc = schema.tables.map((t) => {
      const colDesc = t.columns.map((c) => {
        let extra = '';
        if (c.isPrimary) extra += ' (PRIMARY KEY)';
        if (c.isForeign) extra += ` (FOREIGN KEY referencing ${c.foreignTable}.${c.foreignColumn})`;
        return `    - ${c.name} [${c.type}]${c.nullable ? '' : ' NOT NULL'}${extra}`;
      }).join('\n');
      return `### Table: ${t.name}\n  Schema: ${t.schema}\n  Columns:\n${colDesc}\n  Estimated Row Count: ${t.rowCount}`;
    }).join('\n\n');

    const viewDesc = schema.views.map((v) => {
      return `### View: ${v.name}\n  Schema: ${v.schema}\n  Columns: ${v.columns.join(', ')}\n  Definition: ${v.definition}`;
    }).join('\n\n');

    const procDesc = schema.procedures.map((p) => {
      const params = p.parameters.map((param) => `${param.name} (${param.type})`).join(', ');
      return `### Stored Procedure: ${p.name}\n  Parameters: ${params || 'None'}\n  Definition:\n${p.definition}`;
    }).join('\n\n');

    const contextDesc = this.dbContexts.map((ctx) => {
      return `- Domain: ${ctx.domainName}\n  Business Rules: ${ctx.businessRules}\n  Relationships: ${ctx.relationships}\n  Naming Conventions: ${ctx.conventions}`;
    }).join('\n\n');

    const dictDesc = this.dictionaryEntries.map((dic) => {
      return `- Column '${dic.columnName}' on Table '${dic.tableName}' maps to user friendly term: '${dic.displayName}' (${dic.description})`;
    }).join('\n');

    return `You are an expert Senior Database Architect & SQL Copilot.
You are helping a developer manage a database. Under the hood, this is a real-time database system.

Here is the ACTIVE DATABASE SCHEMA AND OBJECT CATALOG:

--- TABLES ---
${tableDesc}

--- VIEWS ---
${viewDesc || 'None registered'}

--- STORED PROCEDURES ---
${procDesc || 'None registered'}

--- CUSTOM BUSINESS CONTEXT (NON-EMS DOMAINS) ---
Use these custom rules and naming conventions defined by the user to better interpret queries and target structures:
${contextDesc || 'None registered'}

--- COLUMN TECHNICAL DICTIONARY ---
Map obscure columns or technical terms to these user friendly business attributes when writing and explaining queries:
${dictDesc || 'None registered'}

--- SYSTEM SECURITY POLICIES ---
1. You must NEVER suggest DROP DATABASE operations or TRUNCATE operations without explicit safety prompts.
2. If the user request is a read query (SELECT), mark it as read-only.
3. If the user request implies schema modifications (CREATE VIEW, CREATE TABLE, ALTER TABLE, CREATE PROCEDURE), generate the full standard SQL script, list affected objects, and estimate the migration impact.
4. Keep the SQL standard and fully compatible with the current dialect (SQLite or general SQL Server). Avoid MS SQL proprietary functions (like DATEADD) if SQLite is specified unless writing simulated guides. Keep SQL commands extremely clean and optimized.

USER REQUEST: "${userRequest}"

You must return your response STRICTLY as a valid JSON object matching the following structure:
{
  "sql": "The clean, formatted, executable SQL statement. Use backticks or double quotes appropriately.",
  "explanation": "A concise step-by-step description of what this SQL does, any database conventions assumed, and why this is the best design.",
  "affectedObjects": ["List of tables or views read from, or written to, or created"],
  "estimatedImpact": "Description of load impact (e.g., Fast index scan, low-cost view creation, or table write scan)",
  "isDdl": true/false (true if this creates/alters tables/views/procedures, false if it is a standard SELECT data query)
}

Do not return any markdown wraps (like \`\`\`json) outside of the JSON object. Just return the pure JSON.`;
  }

  // Main Copilot handler
  public async generateSqlProposal(schema: SchemaMetadata, userRequest: string): Promise<any> {
    try {
      const prompt = this.buildPrompt(schema, userRequest);
      const text = await this.executeLlmCall(prompt, {
        type: Type.OBJECT,
        properties: {
          sql: { type: Type.STRING },
          explanation: { type: Type.STRING },
          affectedObjects: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          estimatedImpact: { type: Type.STRING },
          isDdl: { type: Type.BOOLEAN }
        },
        required: ['sql', 'explanation', 'affectedObjects', 'estimatedImpact', 'isDdl']
      });

      let responseText = text.trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
      }
      return JSON.parse(responseText);
    } catch (err: any) {
      const isConnError = err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('offline') || err.message.includes('unreachable') || err.message.includes('fetch failed'));
      if (isConnError) {
        console.warn(`Copilot SQL proposal generation fell back because active provider was offline: ${err.message}`);
      } else {
        console.error('Copilot SQL proposal generation failed, using fallback:', err);
      }
      return this.generateFallbackProposal(schema, userRequest);
    }
  }

  // Rich rule-based fallback when Gemini API key is missing or calls error out
  private generateFallbackProposal(schema: SchemaMetadata, request: string): any {
    const lower = request.toLowerCase();
    const tableNames = schema.tables.map(t => t.name.toLowerCase());

    // 1. BMS (Building Management System) Queries
    if (lower.includes('bms') || lower.includes('temp') || lower.includes('co2') || lower.includes('humidity')) {
      if (tableNames.includes('bmslogs') && tableNames.includes('bmspoints')) {
        return {
          sql: `SELECT 
  p.Name as PointName,
  p.Parameter,
  p.Unit,
  AVG(l.Value) as AverageValue,
  MAX(l.Value) as MaxValue,
  MIN(l.Value) as MinValue,
  COUNT(CASE WHEN l.Status = 'HIGH' THEN 1 END) as HighAlarmCount
FROM BmsLogs l
JOIN BmsPoints p ON l.PointID = p.PointID
GROUP BY p.PointID;`,
          explanation: 'Aggregates Building Management System (BMS) logs, showing baseline averages, maximum/minimum ranges, and count of high-level carbon dioxide or thermal alarms.',
          affectedObjects: ['BmsLogs', 'BmsPoints'],
          estimatedImpact: 'Low impact. Grouped scan over active BMS point sensors.',
          isDdl: false
        };
      }
    }

    // 2. Water Management Queries
    if (lower.includes('water') || lower.includes('flow') || lower.includes('m3') || lower.includes('pipe')) {
      if (tableNames.includes('waterlogs') && tableNames.includes('watersensors')) {
        return {
          sql: `SELECT 
  s.Name as SensorLocation,
  s.PipeDiameterMm,
  MAX(l.FlowRateLps) as PeakFlowLps,
  MAX(l.TotalVolumeM3) - MIN(l.TotalVolumeM3) as TotalM3Consumed,
  COUNT(l.LogID) as TotalIntervalCount
FROM WaterLogs l
JOIN WaterSensors s ON l.SensorID = s.SensorID
GROUP BY s.SensorID;`,
          explanation: 'Computes cumulative water consumption (in cubic meters) and peak volumetric flow rate per valve node, grouped by physical pipe diameter indices.',
          affectedObjects: ['WaterLogs', 'WaterSensors'],
          estimatedImpact: 'Low impact. Groups flow measurements on active sub-meters.',
          isDdl: false
        };
      }
    }

    // 3. CMS (Chiller / Compressor / Heavy Equipment Asset) Queries
    if (lower.includes('cms') || lower.includes('chiller') || lower.includes('compressor') || lower.includes('maintenance')) {
      if (tableNames.includes('cmsequipment') && tableNames.includes('cmsmaintenancelogs')) {
        return {
          sql: `SELECT 
  e.Name as EquipmentName,
  e.Type,
  e.RunningHours,
  e.Status,
  COUNT(m.LogID) as RepairCount,
  SUM(m.Cost) as TotalMaintenanceCost
FROM CmsEquipment e
LEFT JOIN CmsMaintenanceLogs m ON e.EquipID = m.EquipID
GROUP BY e.EquipID
ORDER BY TotalMaintenanceCost DESC;`,
          explanation: 'Performs a LEFT JOIN to aggregate the service record history, repair tallies, and total maintenance expenditure per heavy mechanical asset.',
          affectedObjects: ['CmsEquipment', 'CmsMaintenanceLogs'],
          estimatedImpact: 'Very low cost. Scans static equipment catalogs and maintenance ledgers.',
          isDdl: false
        };
      }
    }

    // 4. Electrical Historian (Ampere & Voltage) Queries
    if (lower.includes('historian') || lower.includes('ampere') || lower.includes('voltage') || lower.includes('powerfactor')) {
      if (tableNames.includes('electricalhistorian')) {
        return {
          sql: `SELECT 
  Timestamp,
  NodeName,
  (AmpereL1 + AmpereL2 + AmpereL3)/3.0 as AvgAmpere,
  (VoltageL1 + VoltageL2 + VoltageL3)/3.0 as AvgVoltage,
  PowerFactor,
  -- Check for current imbalance
  ABS(AmpereL1 - ((AmpereL1 + AmpereL2 + AmpereL3)/3.0)) as L1Imbalance
FROM ElectricalHistorian
WHERE PowerFactor < 0.90
ORDER BY Timestamp DESC
LIMIT 50;`,
          explanation: 'Checks the historical power line ledger for periods with poor power factors, calculating phase current imbalances to locate load-symmetry issues.',
          affectedObjects: ['ElectricalHistorian'],
          estimatedImpact: 'Medium impact. Selects matching time blocks up to the 50 newest frames.',
          isDdl: false
        };
      }
    }

    // 5. Default EMS Energy Queries if requested specifically
    if (tableNames.includes('kwhlogs') && tableNames.includes('meters')) {
      if (lower.includes('weekly') || lower.includes('week') || lower.includes('consumption') || lower.includes('energy') || lower.includes('kwh')) {
        return {
          sql: `SELECT 
  strftime('%Y-%W', Timestamp) as YearWeek,
  MeterID,
  SUM(IntervalKwh) as WeeklyTotalKwh,
  AVG(IntervalKwh) as HourlyAverageKwh,
  COUNT(LogID) as RecordsCount
FROM KwhLogs
GROUP BY YearWeek, MeterID
ORDER BY YearWeek DESC, WeeklyTotalKwh DESC;`,
          explanation: 'Groups active electricity intervals by calendar weeks using standard SQLite strftime, summarizing aggregate power grids and load averages.',
          affectedObjects: ['KwhLogs'],
          estimatedImpact: 'Medium impact. Aggregates time-series energy logs.',
          isDdl: false
        };
      }
    }

    // 6. Generic DB table-agnostic query builder as ultimate backup
    if (schema.tables.length > 0) {
      const firstTable = schema.tables[0].name;
      return {
        sql: `SELECT * FROM ${firstTable} LIMIT 20;`,
        explanation: `Decoded schema object catalog successfully. Visualizing a read preview of the raw rows inside the primary table '${firstTable}' to inspect available variables.`,
        affectedObjects: [firstTable],
        estimatedImpact: 'Fast index scanning with LIMIT constraints.',
        isDdl: false
      };
    }

    return {
      sql: 'SELECT 1;',
      explanation: 'No tables currently exist in this database. Initialize a custom table or schema to start managing datasets.',
      affectedObjects: [],
      estimatedImpact: 'Immediate.',
      isDdl: false
    };
  }

  // Analyze a SQL query in plain English
  public async analyzeSqlQuery(schema: SchemaMetadata, sqlText: string): Promise<any> {
    if (!sqlText || !sqlText.trim()) {
      return {
        explanation: 'No SQL query provided for analysis.',
        operationType: 'UNKNOWN',
        retrievedTables: [],
        filteredColumns: [],
        stepByStep: []
      };
    }

    try {
      const prompt = `You are a Senior SQL Performance Optimizer & DB Analyst. 
Analyze the following SQL query and break it down in plain English.

SQL QUERY:
${sqlText}

DATABASE SCHEMA CATALOG:
${schema.tables.map(t => `- Table: ${t.name}, Columns: ${t.columns.map(c => c.name).join(', ')}`).join('\n')}

Analyze exactly what operations, tables, columns, filters, aggregates, or writes are performed.
Return your response STRICTLY as a JSON object matching the following structure:
{
  "explanation": "A concise paragraph explaining exactly what data is being retrieved or modified in simple business terms.",
  "operationType": "SELECT | INSERT | UPDATE | DELETE | DDL",
  "retrievedTables": ["list of tables accessed"],
  "filteredColumns": ["list of columns filtered, joined or aggregated"],
  "stepByStep": [
    "Step 1: description...",
    "Step 2: description..."
  ]
}
Do not write markdown wraps. Just return pure JSON.`;

      const text = await this.executeLlmCall(prompt, {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          operationType: { type: Type.STRING },
          retrievedTables: { type: Type.ARRAY, items: { type: Type.STRING } },
          filteredColumns: { type: Type.ARRAY, items: { type: Type.STRING } },
          stepByStep: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['explanation', 'operationType', 'retrievedTables', 'filteredColumns', 'stepByStep']
      });

      let responseText = text.trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
      }
      return JSON.parse(responseText);
    } catch (err: any) {
      const isConnError = err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('offline') || err.message.includes('unreachable') || err.message.includes('fetch failed'));
      if (isConnError) {
        console.warn(`AI analysis fell back because active provider was offline: ${err.message}`);
      } else {
        console.error('AI analysis failed, using local parser:', err);
      }
      return this.fallbackAnalyzeSqlQuery(schema, sqlText);
    }
  }

  private fallbackAnalyzeSqlQuery(schema: SchemaMetadata, sqlText: string): any {
    const cleanSql = sqlText.replace(/\s+/g, ' ');
    const lower = sqlText.toLowerCase();
    
    let opType = 'SELECT';
    if (lower.includes('insert ')) opType = 'INSERT';
    else if (lower.includes('update ')) opType = 'UPDATE';
    else if (lower.includes('delete ')) opType = 'DELETE';
    else if (lower.includes('create ') || lower.includes('alter ') || lower.includes('drop ')) opType = 'DDL';

    // Extract table names
    const accessedTables: string[] = [];
    for (const t of schema.tables) {
      const regex = new RegExp('\\b' + t.name + '\\b', 'i');
      if (regex.test(cleanSql)) {
        accessedTables.push(t.name);
      }
    }

    // Extract columns
    const columnsList: string[] = [];
    for (const t of schema.tables) {
      for (const c of t.columns) {
        const regex = new RegExp('\\b' + c.name + '\\b', 'i');
        if (regex.test(cleanSql) && !columnsList.includes(c.name)) {
          columnsList.push(c.name);
        }
      }
    }

    // Friendly explanation
    let expl = `This is a ${opType} statement targeting the database.`;
    if (accessedTables.length > 0) {
      expl += ` It operates on table${accessedTables.length === 1 ? '' : 's'} (${accessedTables.join(', ')}) to access variables.`;
    }
    if (lower.includes('join ')) {
      expl += ` It joins multiple datasets together using correlated matching keys to consolidate multi-domain attributes.`;
    }
    if (lower.includes('where ')) {
      expl += ` It applies search filtering parameters to subset the logs based on specific target constraints.`;
    }
    if (lower.includes('group by ')) {
      expl += ` It aggregates high-frequency interval readings to produce summary metrics like averages or peaks.`;
    }

    const steps = [
      `Initialize execution context for ${opType} transaction.`,
      accessedTables.length > 0 
        ? `Scan indices or cluster registers for referenced table(s): ${accessedTables.join(', ')}.`
        : 'Process basic computation expression.',
    ];
    if (lower.includes('join ')) {
      steps.push('Perform matching loop on primary/foreign key connections to reconcile records.');
    }
    if (lower.includes('where ')) {
      steps.push('Apply conditional filter constraints to exclude out-of-bounds metrics.');
    }
    if (lower.includes('group by ')) {
      steps.push('Bucket records by grouped attributes and run mathematical summaries.');
    }
    steps.push('Buffer execution result set and output rows to client console.');

    return {
      explanation: expl,
      operationType: opType,
      retrievedTables: accessedTables,
      filteredColumns: columnsList,
      stepByStep: steps
    };
  }

  // Audit a SQL query for physical dependencies, missing join keys, unindexed scans, or orphaned writes
  public auditSqlQuery(schema: SchemaMetadata, sqlText: string): any[] {
    const warnings: any[] = [];
    if (!sqlText || !sqlText.trim()) return warnings;

    const lower = sqlText.toLowerCase();
    const cleanSql = sqlText.replace(/\s+/g, ' ');

    // 1. Identify active tables in query
    const accessedTables = schema.tables.filter(t => {
      const regex = new RegExp('\\b' + t.name + '\\b', 'i');
      return regex.test(cleanSql);
    });

    if (accessedTables.length === 0) return warnings;

    // 2. Warn about DELETION or MODIFICATION without WHERE clause
    const hasWhere = lower.includes('where');
    if ((lower.includes('delete') || lower.includes('update')) && !hasWhere) {
      warnings.push({
        type: 'danger',
        message: 'Unrestricted Write Hazard',
        detail: `The update/delete operation on table(s) does not contain a WHERE clause. This will overwrite or truncate ALL rows in the table.`,
        tables: accessedTables.map(t => t.name)
      });
    }

    // 3. Foreign key constraints and JOIN check
    if (accessedTables.length > 1) {
      const relations: Array<{ from: string; to: string; fromCol: string; toCol: string }> = [];
      for (const t of accessedTables) {
        for (const c of t.columns) {
          if (c.isForeign && c.foreignTable) {
            const isTargetAccessed = accessedTables.some(at => at.name.toLowerCase() === c.foreignTable!.toLowerCase());
            if (isTargetAccessed) {
              relations.push({
                from: t.name,
                to: c.foreignTable,
                fromCol: c.name,
                toCol: c.foreignColumn || ''
              });
            }
          }
        }
      }

      const hasJoin = lower.includes('join');
      if (hasJoin && relations.length > 0) {
        for (const rel of relations) {
          const hasFromCol = new RegExp('\\b' + rel.fromCol + '\\b', 'i').test(cleanSql);
          const hasToCol = new RegExp('\\b' + rel.toCol + '\\b', 'i').test(cleanSql);
          
          if (!hasFromCol || !hasToCol) {
            warnings.push({
              type: 'warning',
              message: 'Potential Cartesian Join Hazard',
              detail: `You are querying related tables '${rel.from}' and '${rel.to}' but may have missed matching the registered foreign key relationship: ${rel.from}.${rel.fromCol} = ${rel.to}.${rel.toCol}. This can lead to slow execution or bloated Cartesian duplicates.`,
              tables: [rel.from, rel.to]
            });
          }
        }
      } else if (!hasJoin && relations.length > 0) {
        warnings.push({
          type: 'warning',
          message: 'Missing Explicit JOIN Statement',
          detail: `Query references multiple connected tables (${accessedTables.map(t => t.name).join(', ')}) but does not use explicit JOIN clauses. It is recommended to use INNER/LEFT JOIN and match on registered foreign key constraints.`,
          tables: accessedTables.map(t => t.name)
        });
      }
    }

    // 4. Primary key selection safety warning on UPDATE/DELETE
    if ((lower.includes('update') || lower.includes('delete')) && hasWhere) {
      for (const t of accessedTables) {
        const pkColumn = t.columns.find(c => c.isPrimary);
        if (pkColumn) {
          const hasPkInWhere = new RegExp('\\b' + pkColumn.name + '\\b', 'i').test(cleanSql.substring(lower.indexOf('where')));
          if (!hasPkInWhere) {
            warnings.push({
              type: 'info',
              message: 'Non-Primary Key Filter Warning',
              detail: `The write transaction on table '${t.name}' is filtering rows using non-primary keys. Ensure this is intentional, as it may update multiple sibling records. Filtering by primary key '${pkColumn.name}' is safer for single row operations.`,
              tables: [t.name]
            });
          }
        }
      }
    }

    // 5. Destructive write on critical telemetry warnings
    const destructiveKeywords = ['drop table', 'alter table', 'truncate'];
    for (const kw of destructiveKeywords) {
      if (lower.includes(kw)) {
        warnings.push({
          type: 'danger',
          message: 'Structural Schema Modification (DDL)',
          detail: `Your statement performs a direct structural change. This modifies the physical database catalog and can cause down-stream table corruption or telemetry system failure if active sensors are logging.`,
          tables: accessedTables.map(t => t.name)
        });
      }
    }

    return warnings;
  }
}

export const copilot = new SqlCopilot();
