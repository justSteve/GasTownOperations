/**
 * @fileoverview CrudEngine - The main class for managing ECC artifact CRUD operations
 *
 * The CrudEngine composes all artifact handlers, wraps operations with traffic
 * logging, manages operation history, and provides a unified CRUD interface.
 *
 * @module @ecc/crud/core/crud-engine
 */

import type { ArtifactType, OperationKind } from '../types/operation-types.js';
import type { OperationResult } from '../types/result-types.js';
import type {
  EccSkill,
  EccHook,
  EccSubAgent,
  EccRule,
  EccAgent,
  EccCommand,
  EccMcpServer,
} from '../types/artifact-types.js';
import { skillHandler } from '../artifacts/skill-handler.js';
import { hookHandler } from '../artifacts/hook-handler.js';
import { subAgentHandler } from '../artifacts/subagent-handler.js';
import { ruleHandler } from '../artifacts/rule-handler.js';
import { agentHandler } from '../artifacts/agent-handler.js';
import { commandHandler } from '../artifacts/command-handler.js';
import { mcpServerHandler } from '../artifacts/mcp-server-handler.js';
import type { ArtifactHandler } from '../artifacts/hook-handler.js';
import {
  withTrafficLogging,
  generateOperationId,
  type Logger,
  type LogContext,
} from '../logging/traffic-logger.js';
import {
  OperationHistory,
  createHistoryEntry,
  type OperationHistoryEntry,
} from '../versioning/history.js';
import { captureSnapshot } from '../versioning/snapshot.js';
import {
  SubscriptionManager,
  computeFieldChanges,
  type ChangeSubscriber,
  type Unsubscribe,
} from './subscription.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the CRUD Engine.
 */
export interface CrudEngineConfig {
  /** Logging configuration */
  logging: {
    /** Minimum log level */
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    /** Whether to include artifact state in log entries */
    includeStateInLogs: boolean;
    /** Whether to log to console */
    logToConsole: boolean;
  };
  /** Versioning configuration */
  versioning: {
    /** Whether to capture before/after snapshots */
    captureSnapshots: boolean;
    /** Maximum number of history entries to retain */
    historySize: number;
  };
}

/**
 * Engine mode for preset configurations.
 */
export type EngineMode = 'development' | 'production';

/**
 * Development mode configuration - verbose logging, larger history.
 */
const DEV_CONFIG: CrudEngineConfig = {
  logging: {
    level: 'DEBUG',
    includeStateInLogs: true,
    logToConsole: true,
  },
  versioning: {
    captureSnapshots: true,
    historySize: 100,
  },
};

/**
 * Production mode configuration - minimal logging, smaller history.
 */
const PROD_CONFIG: CrudEngineConfig = {
  logging: {
    level: 'INFO',
    includeStateInLogs: false,
    logToConsole: false,
  },
  versioning: {
    captureSnapshots: true,
    historySize: 20,
  },
};

// ============================================================================
// Option Types
// ============================================================================

/**
 * Options for create operations.
 */
export interface CreateOptions {
  /** Overwrite existing artifact */
  overwrite?: boolean;
  /** Validate only, don't persist */
  dryRun?: boolean;
}

/**
 * Options for read operations.
 */
export interface ReadOptions {
  /** Include full content in response */
  includeContent?: boolean;
}

/**
 * Options for update operations.
 */
export interface UpdateOptions {
  /** Merge changes with existing (default: true) */
  merge?: boolean;
  /** Validate only, don't persist */
  dryRun?: boolean;
}

/**
 * Options for delete operations.
 */
export interface DeleteOptions {
  /** Soft delete (mark as deleted) instead of hard delete */
  soft?: boolean;
  /** Validate only, don't persist */
  dryRun?: boolean;
}

// ============================================================================
// CrudEngine Class
// ============================================================================

/**
 * The main CRUD Engine class.
 *
 * Provides a unified interface for Create, Read, Update, Delete operations
 * on all ECC artifact types. Operations are wrapped with traffic logging
 * and state snapshots are captured for versioning.
 *
 * @example
 * ```typescript
 * // Create engine with default development config
 * const engine = createCrudEngine('/path/to/project', 'development');
 *
 * // Create a skill
 * const result = await engine.createSkill({
 *   id: 'core/my-skill',
 *   pluginId: 'core',
 *   name: 'my-skill',
 *   category: 'core',
 *   description: 'A custom skill',
 * });
 *
 * // Read it back
 * const skill = await engine.readSkill('core/my-skill');
 *
 * // List all skills
 * const allSkills = await engine.list<EccSkill>('skill');
 *
 * // Get operation history
 * const recent = engine.getRecentOperations(10);
 * ```
 */
export class CrudEngine {
  private readonly projectRoot: string;
  private readonly config: CrudEngineConfig;
  private readonly logger: Logger;
  private readonly history: OperationHistory;
  private readonly handlers: Map<ArtifactType, ArtifactHandler<unknown>>;
  private readonly subscriptions: SubscriptionManager;

  /**
   * Create a new CrudEngine instance.
   *
   * @param projectRoot - The root directory of the project
   * @param config - Optional configuration (defaults to DEV_CONFIG)
   */
  constructor(projectRoot: string, config?: CrudEngineConfig) {
    this.projectRoot = projectRoot;
    this.config = config ?? DEV_CONFIG;

    // Create logger based on config
    this.logger = this.createLogger();

    // Create history with configured size
    this.history = new OperationHistory(this.config.versioning.historySize);

    // Create subscription manager
    this.subscriptions = new SubscriptionManager();

    // Register all handlers
    this.handlers = new Map<ArtifactType, ArtifactHandler<unknown>>([
      ['skill', skillHandler as ArtifactHandler<unknown>],
      ['hook', hookHandler as ArtifactHandler<unknown>],
      ['subagent', subAgentHandler as ArtifactHandler<unknown>],
      ['rule', ruleHandler as ArtifactHandler<unknown>],
      ['agent', agentHandler as ArtifactHandler<unknown>],
      ['command', commandHandler as ArtifactHandler<unknown>],
      ['mcp-server', mcpServerHandler as ArtifactHandler<unknown>],
    ]);
  }

  /**
   * Create a logger based on configuration.
   *
   * Creates either a console logger or a null logger depending on config.
   */
  private createLogger(): Logger {
    const logLevel = this.config.logging.level;
    const logToConsole = this.config.logging.logToConsole;

    // Log level values for filtering
    const LOG_LEVEL_VALUES: Record<string, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };

    const minLevel = LOG_LEVEL_VALUES[logLevel] ?? 1;

    // No-op logger for when console logging is disabled
    if (!logToConsole) {
      const nullLogger: Logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: () => nullLogger,
        event: () => {},
      };
      return nullLogger;
    }

    // Console logger implementation
    const shouldLog = (level: string): boolean => {
      return (LOG_LEVEL_VALUES[level] ?? 0) >= minLevel;
    };

    const formatMessage = (
      level: string,
      message: string,
      context?: LogContext
    ): string => {
      const timestamp = new Date().toISOString();
      const contextStr = context && Object.keys(context).length > 0
        ? ` ${JSON.stringify(context)}`
        : '';
      return `[${timestamp}] [${level}] ${message}${contextStr}`;
    };

    const createChildLogger = (parentContext: LogContext): Logger => {
      const childLogger: Logger = {
        debug: (message: string, context?: LogContext) => {
          if (shouldLog('DEBUG')) {
            console.log(formatMessage('DEBUG', message, { ...parentContext, ...context }));
          }
        },
        info: (message: string, context?: LogContext) => {
          if (shouldLog('INFO')) {
            console.log(formatMessage('INFO', message, { ...parentContext, ...context }));
          }
        },
        warn: (message: string, context?: LogContext) => {
          if (shouldLog('WARN')) {
            console.warn(formatMessage('WARN', message, { ...parentContext, ...context }));
          }
        },
        error: (message: string, error?: Error, context?: LogContext) => {
          if (shouldLog('ERROR')) {
            const mergedContext = { ...parentContext, ...context };
            if (error) {
              mergedContext.errorName = error.name;
              mergedContext.errorMessage = error.message;
            }
            console.error(formatMessage('ERROR', message, mergedContext));
          }
        },
        child: (context: LogContext) => createChildLogger({ ...parentContext, ...context }),
        event: (type: string, data: Record<string, unknown>) => {
          if (shouldLog('INFO')) {
            console.log(formatMessage('INFO', `Event: ${type}`, { ...parentContext, ...data, eventType: type }));
          }
        },
      };
      return childLogger;
    };

    return createChildLogger({});
  }

  /**
   * Get a handler for the specified artifact type.
   */
  private getHandler<T>(artifactType: ArtifactType): ArtifactHandler<T> {
    const handler = this.handlers.get(artifactType);
    if (!handler) {
      throw new Error(`No handler registered for artifact type: ${artifactType}`);
    }
    return handler as ArtifactHandler<T>;
  }

  /**
   * Extract artifact ID from an artifact object.
   */
  private getArtifactId(artifact: unknown): string {
    if (artifact && typeof artifact === 'object') {
      const obj = artifact as Record<string, unknown>;
      // Skills use category/name format
      if (obj.category && obj.name) {
        return `${obj.category}/${obj.name}`;
      }
      // Others use name or id
      if (typeof obj.name === 'string') {
        return obj.name;
      }
      if (typeof obj.id === 'string') {
        return obj.id;
      }
    }
    return 'unknown';
  }

  // ==========================================================================
  // Generic CRUD Operations
  // ==========================================================================

  /**
   * Create a new artifact.
   *
   * @param artifactType - The type of artifact to create
   * @param artifact - The artifact data
   * @param options - Create options
   * @returns Operation result with the created artifact
   */
  async create<T>(
    artifactType: ArtifactType,
    artifact: T,
    options?: CreateOptions
  ): Promise<OperationResult<T>> {
    const handler = this.getHandler<T>(artifactType);
    const artifactId = this.getArtifactId(artifact);
    const operationId = generateOperationId();

    // Capture before state (should be null for create)
    const beforeSnapshot = this.config.versioning.captureSnapshots
      ? await captureSnapshot<T>(artifactType, artifactId, this.projectRoot, null)
      : null;

    // Build handler options, only including defined properties
    const handlerOptions: { overwrite?: boolean; dryRun?: boolean } = {};
    if (options?.overwrite !== undefined) {
      handlerOptions.overwrite = options.overwrite;
    }
    if (options?.dryRun !== undefined) {
      handlerOptions.dryRun = options.dryRun;
    }

    // Execute with traffic logging
    const result = await withTrafficLogging(
      this.logger,
      async () => {
        return handler.create(this.projectRoot, artifact, handlerOptions);
      },
      {
        operation: 'create' as OperationKind,
        artifactType,
        artifactId,
      }
    );

    // Capture after state and add to history
    if (this.config.versioning.captureSnapshots && beforeSnapshot && result.success) {
      const afterState = result.data ?? null;
      const afterSnapshot = await captureSnapshot<T>(
        artifactType,
        artifactId,
        this.projectRoot,
        afterState
      );

      const historyEntry = createHistoryEntry(
        operationId,
        {
          type: 'create',
          artifactType,
          artifact,
        },
        result,
        beforeSnapshot,
        afterSnapshot
      );

      this.history.add(historyEntry);
    }

    // Emit change event for successful create operations
    if (result.success && result.data) {
      this.subscriptions.emit<T>({
        type: 'created',
        artifactType,
        artifactId,
        timestamp: new Date().toISOString(),
        artifact: result.data,
      });
    }

    return result;
  }

  /**
   * Read an artifact by ID.
   *
   * @param artifactType - The type of artifact to read
   * @param id - The artifact identifier
   * @param options - Read options
   * @returns Operation result with the artifact data
   */
  async read<T>(
    artifactType: ArtifactType,
    id: string,
    options?: ReadOptions
  ): Promise<OperationResult<T>> {
    const handler = this.getHandler<T>(artifactType);

    // Build handler options, only including defined properties
    const handlerOptions: { includeContent?: boolean } = {};
    if (options?.includeContent !== undefined) {
      handlerOptions.includeContent = options.includeContent;
    }

    // Execute with traffic logging (read operations don't capture state by default)
    const result = await withTrafficLogging(
      this.logger,
      async () => {
        return handler.read(this.projectRoot, id, handlerOptions);
      },
      {
        operation: 'read' as OperationKind,
        artifactType,
        artifactId: id,
      }
    );

    return result;
  }

  /**
   * Update an existing artifact.
   *
   * @param artifactType - The type of artifact to update
   * @param id - The artifact identifier
   * @param changes - Partial changes to apply
   * @param options - Update options
   * @returns Operation result with the updated artifact
   */
  async update<T>(
    artifactType: ArtifactType,
    id: string,
    changes: Partial<T>,
    options?: UpdateOptions
  ): Promise<OperationResult<T>> {
    const handler = this.getHandler<T>(artifactType);
    const operationId = generateOperationId();

    // Capture before state for versioning and change tracking
    let beforeSnapshot = null;
    let beforeState: T | null = null;
    const existingResult = await handler.read(this.projectRoot, id, { includeContent: true });
    if (existingResult.success && existingResult.data) {
      beforeState = existingResult.data as T;
    }

    if (this.config.versioning.captureSnapshots) {
      beforeSnapshot = await captureSnapshot<T>(
        artifactType,
        id,
        this.projectRoot,
        beforeState
      );
    }

    // Build handler options, only including defined properties
    const handlerOptions: { merge?: boolean; dryRun?: boolean } = {};
    if (options?.merge !== undefined) {
      handlerOptions.merge = options.merge;
    }
    if (options?.dryRun !== undefined) {
      handlerOptions.dryRun = options.dryRun;
    }

    // Build logging context
    const loggingContext: { operation: OperationKind; artifactType: ArtifactType; artifactId: string; beforeState?: unknown } = {
      operation: 'update' as OperationKind,
      artifactType,
      artifactId: id,
    };
    if (this.config.logging.includeStateInLogs && beforeSnapshot) {
      loggingContext.beforeState = beforeSnapshot.state;
    }

    // Execute with traffic logging
    const result = await withTrafficLogging(
      this.logger,
      async () => {
        return handler.update(this.projectRoot, id, changes, handlerOptions);
      },
      loggingContext
    );

    // Capture after state and add to history
    if (this.config.versioning.captureSnapshots && beforeSnapshot && result.success) {
      const afterState = result.data ?? null;
      const afterSnapshot = await captureSnapshot<T>(
        artifactType,
        id,
        this.projectRoot,
        afterState
      );

      const historyEntry = createHistoryEntry(
        operationId,
        {
          type: 'update',
          artifactType,
          id,
          changes,
        },
        result,
        beforeSnapshot,
        afterSnapshot
      );

      this.history.add(historyEntry);
    }

    // Emit change event for successful update operations
    if (result.success && result.data) {
      // Compute field-level changes if we have before state
      const fieldChanges = beforeState
        ? computeFieldChanges(
            beforeState as Record<string, unknown>,
            result.data as Record<string, unknown>
          )
        : [];

      this.subscriptions.emit<T>({
        type: 'updated',
        artifactType,
        artifactId: id,
        timestamp: new Date().toISOString(),
        artifact: result.data,
        changes: fieldChanges,
      });
    }

    return result;
  }

  /**
   * Delete an artifact.
   *
   * @param artifactType - The type of artifact to delete
   * @param id - The artifact identifier
   * @param options - Delete options
   * @returns Operation result confirming deletion
   */
  async delete(
    artifactType: ArtifactType,
    id: string,
    options?: DeleteOptions
  ): Promise<OperationResult<void>> {
    const handler = this.getHandler<unknown>(artifactType);
    const operationId = generateOperationId();

    // Capture before state for versioning and change tracking
    let beforeSnapshot = null;
    let beforeState: unknown = null;
    const existingResult = await handler.read(this.projectRoot, id, { includeContent: true });
    if (existingResult.success && existingResult.data) {
      beforeState = existingResult.data;
    }

    if (this.config.versioning.captureSnapshots) {
      beforeSnapshot = await captureSnapshot(
        artifactType,
        id,
        this.projectRoot,
        beforeState
      );
    }

    // Build handler options, only including defined properties
    const handlerOptions: { soft?: boolean; dryRun?: boolean } = {};
    if (options?.soft !== undefined) {
      handlerOptions.soft = options.soft;
    }
    if (options?.dryRun !== undefined) {
      handlerOptions.dryRun = options.dryRun;
    }

    // Build logging context
    const loggingContext: { operation: OperationKind; artifactType: ArtifactType; artifactId: string; beforeState?: unknown } = {
      operation: 'delete' as OperationKind,
      artifactType,
      artifactId: id,
    };
    if (this.config.logging.includeStateInLogs && beforeSnapshot) {
      loggingContext.beforeState = beforeSnapshot.state;
    }

    // Execute with traffic logging
    const result = await withTrafficLogging(
      this.logger,
      async () => {
        return handler.delete(this.projectRoot, id, handlerOptions);
      },
      loggingContext
    );

    // Capture after state (null for delete) and add to history
    if (this.config.versioning.captureSnapshots && beforeSnapshot && result.success) {
      const afterSnapshot = await captureSnapshot<unknown>(
        artifactType,
        id,
        this.projectRoot,
        null
      );

      // Use type assertion to satisfy the history entry typing
      // beforeSnapshot and afterSnapshot have compatible structures
      const historyEntry = createHistoryEntry<unknown>(
        operationId,
        {
          type: 'delete',
          artifactType,
          id,
        },
        result as OperationResult<unknown>,
        beforeSnapshot,
        afterSnapshot
      );

      this.history.add(historyEntry);
    }

    // Emit change event for successful delete operations
    if (result.success) {
      this.subscriptions.emit({
        type: 'deleted',
        artifactType,
        artifactId: id,
        timestamp: new Date().toISOString(),
        deletedArtifact: beforeState,
      });
    }

    return result;
  }

  /**
   * List all artifacts of a type.
   *
   * @param artifactType - The type of artifacts to list
   * @returns Operation result with array of artifacts
   */
  async list<T>(artifactType: ArtifactType): Promise<OperationResult<T[]>> {
    const handler = this.getHandler<T>(artifactType);

    // Execute with traffic logging
    const result = await withTrafficLogging(
      this.logger,
      async () => {
        return handler.list(this.projectRoot);
      },
      {
        operation: 'query' as OperationKind,
        artifactType,
      }
    );

    return result;
  }

  // ==========================================================================
  // Typed Convenience Methods - Skills
  // ==========================================================================

  /**
   * Create a new skill.
   */
  async createSkill(skill: EccSkill, options?: CreateOptions): Promise<OperationResult<EccSkill>> {
    return this.create<EccSkill>('skill', skill, options);
  }

  /**
   * Read a skill by ID.
   */
  async readSkill(id: string, options?: ReadOptions): Promise<OperationResult<EccSkill>> {
    return this.read<EccSkill>('skill', id, options);
  }

  /**
   * Update a skill.
   */
  async updateSkill(
    id: string,
    changes: Partial<EccSkill>,
    options?: UpdateOptions
  ): Promise<OperationResult<EccSkill>> {
    return this.update<EccSkill>('skill', id, changes, options);
  }

  /**
   * Delete a skill.
   */
  async deleteSkill(id: string, options?: DeleteOptions): Promise<OperationResult<void>> {
    return this.delete('skill', id, options);
  }

  /**
   * List all skills.
   */
  async listSkills(): Promise<OperationResult<EccSkill[]>> {
    return this.list<EccSkill>('skill');
  }

  // ==========================================================================
  // Typed Convenience Methods - Hooks
  // ==========================================================================

  /**
   * Create a new hook.
   */
  async createHook(hook: EccHook, options?: CreateOptions): Promise<OperationResult<EccHook>> {
    return this.create<EccHook>('hook', hook, options);
  }

  /**
   * Read a hook by name.
   */
  async readHook(name: string, options?: ReadOptions): Promise<OperationResult<EccHook>> {
    return this.read<EccHook>('hook', name, options);
  }

  /**
   * Update a hook.
   */
  async updateHook(
    name: string,
    changes: Partial<EccHook>,
    options?: UpdateOptions
  ): Promise<OperationResult<EccHook>> {
    return this.update<EccHook>('hook', name, changes, options);
  }

  /**
   * Delete a hook.
   */
  async deleteHook(name: string, options?: DeleteOptions): Promise<OperationResult<void>> {
    return this.delete('hook', name, options);
  }

  /**
   * List all hooks.
   */
  async listHooks(): Promise<OperationResult<EccHook[]>> {
    return this.list<EccHook>('hook');
  }

  // ==========================================================================
  // Typed Convenience Methods - SubAgents
  // ==========================================================================

  /**
   * Create a new sub-agent.
   */
  async createSubAgent(
    subAgent: EccSubAgent,
    options?: CreateOptions
  ): Promise<OperationResult<EccSubAgent>> {
    return this.create<EccSubAgent>('subagent', subAgent, options);
  }

  /**
   * Read a sub-agent by name.
   */
  async readSubAgent(name: string, options?: ReadOptions): Promise<OperationResult<EccSubAgent>> {
    return this.read<EccSubAgent>('subagent', name, options);
  }

  /**
   * Update a sub-agent.
   */
  async updateSubAgent(
    name: string,
    changes: Partial<EccSubAgent>,
    options?: UpdateOptions
  ): Promise<OperationResult<EccSubAgent>> {
    return this.update<EccSubAgent>('subagent', name, changes, options);
  }

  /**
   * Delete a sub-agent.
   */
  async deleteSubAgent(name: string, options?: DeleteOptions): Promise<OperationResult<void>> {
    return this.delete('subagent', name, options);
  }

  /**
   * List all sub-agents.
   */
  async listSubAgents(): Promise<OperationResult<EccSubAgent[]>> {
    return this.list<EccSubAgent>('subagent');
  }

  // ==========================================================================
  // Typed Convenience Methods - Rules
  // ==========================================================================

  /**
   * Create a new rule.
   */
  async createRule(rule: EccRule, options?: CreateOptions): Promise<OperationResult<EccRule>> {
    return this.create<EccRule>('rule', rule, options);
  }

  /**
   * Read a rule by name.
   */
  async readRule(name: string, options?: ReadOptions): Promise<OperationResult<EccRule>> {
    return this.read<EccRule>('rule', name, options);
  }

  /**
   * Update a rule.
   */
  async updateRule(
    name: string,
    changes: Partial<EccRule>,
    options?: UpdateOptions
  ): Promise<OperationResult<EccRule>> {
    return this.update<EccRule>('rule', name, changes, options);
  }

  /**
   * Delete a rule.
   */
  async deleteRule(name: string, options?: DeleteOptions): Promise<OperationResult<void>> {
    return this.delete('rule', name, options);
  }

  /**
   * List all rules.
   */
  async listRules(): Promise<OperationResult<EccRule[]>> {
    return this.list<EccRule>('rule');
  }

  // ==========================================================================
  // Typed Convenience Methods - Agents
  // ==========================================================================

  /**
   * Create a new agent.
   */
  async createAgent(agent: EccAgent, options?: CreateOptions): Promise<OperationResult<EccAgent>> {
    return this.create<EccAgent>('agent', agent, options);
  }

  /**
   * Read an agent by name.
   */
  async readAgent(name: string, options?: ReadOptions): Promise<OperationResult<EccAgent>> {
    return this.read<EccAgent>('agent', name, options);
  }

  /**
   * Update an agent.
   */
  async updateAgent(
    name: string,
    changes: Partial<EccAgent>,
    options?: UpdateOptions
  ): Promise<OperationResult<EccAgent>> {
    return this.update<EccAgent>('agent', name, changes, options);
  }

  /**
   * Delete an agent.
   */
  async deleteAgent(name: string, options?: DeleteOptions): Promise<OperationResult<void>> {
    return this.delete('agent', name, options);
  }

  /**
   * List all agents.
   */
  async listAgents(): Promise<OperationResult<EccAgent[]>> {
    return this.list<EccAgent>('agent');
  }

  // ==========================================================================
  // Typed Convenience Methods - Commands
  // ==========================================================================

  /**
   * Create a new command.
   */
  async createCommand(
    command: EccCommand,
    options?: CreateOptions
  ): Promise<OperationResult<EccCommand>> {
    return this.create<EccCommand>('command', command, options);
  }

  /**
   * Read a command by name.
   */
  async readCommand(name: string, options?: ReadOptions): Promise<OperationResult<EccCommand>> {
    return this.read<EccCommand>('command', name, options);
  }

  /**
   * Update a command.
   */
  async updateCommand(
    name: string,
    changes: Partial<EccCommand>,
    options?: UpdateOptions
  ): Promise<OperationResult<EccCommand>> {
    return this.update<EccCommand>('command', name, changes, options);
  }

  /**
   * Delete a command.
   */
  async deleteCommand(name: string, options?: DeleteOptions): Promise<OperationResult<void>> {
    return this.delete('command', name, options);
  }

  /**
   * List all commands.
   */
  async listCommands(): Promise<OperationResult<EccCommand[]>> {
    return this.list<EccCommand>('command');
  }

  // ==========================================================================
  // Typed Convenience Methods - MCP Servers
  // ==========================================================================

  /**
   * Create a new MCP server configuration.
   */
  async createMcpServer(
    server: EccMcpServer,
    options?: CreateOptions
  ): Promise<OperationResult<EccMcpServer>> {
    return this.create<EccMcpServer>('mcp-server', server, options);
  }

  /**
   * Read an MCP server by name.
   */
  async readMcpServer(
    name: string,
    options?: ReadOptions
  ): Promise<OperationResult<EccMcpServer>> {
    return this.read<EccMcpServer>('mcp-server', name, options);
  }

  /**
   * Update an MCP server.
   */
  async updateMcpServer(
    name: string,
    changes: Partial<EccMcpServer>,
    options?: UpdateOptions
  ): Promise<OperationResult<EccMcpServer>> {
    return this.update<EccMcpServer>('mcp-server', name, changes, options);
  }

  /**
   * Delete an MCP server.
   */
  async deleteMcpServer(name: string, options?: DeleteOptions): Promise<OperationResult<void>> {
    return this.delete('mcp-server', name, options);
  }

  /**
   * List all MCP servers.
   */
  async listMcpServers(): Promise<OperationResult<EccMcpServer[]>> {
    return this.list<EccMcpServer>('mcp-server');
  }

  // ==========================================================================
  // History Access
  // ==========================================================================

  /**
   * Get the operation history instance.
   */
  getHistory(): OperationHistory {
    return this.history;
  }

  /**
   * Get recent operations from history.
   *
   * @param count - Number of entries to return (default: 10)
   * @returns Array of history entries, newest first
   */
  getRecentOperations(count?: number): OperationHistoryEntry<unknown>[] {
    return this.history.getRecent(count);
  }

  /**
   * Get the project root path.
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get the engine configuration.
   */
  getConfig(): CrudEngineConfig {
    return { ...this.config };
  }

  // ==========================================================================
  // Subscription Methods
  // ==========================================================================

  /**
   * Subscribe to all artifact changes.
   *
   * @param callback - Function to call when any artifact changes
   * @returns Unsubscribe function to remove this subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = engine.subscribe((event) => {
   *   console.log(`${event.type}: ${event.artifactType}/${event.artifactId}`);
   * });
   *
   * // Later: stop listening
   * unsubscribe();
   * ```
   */
  subscribe(callback: ChangeSubscriber): Unsubscribe {
    return this.subscriptions.subscribe(callback);
  }

  /**
   * Subscribe to changes for a specific artifact type.
   *
   * @param artifactType - The artifact type to subscribe to
   * @param callback - Function to call when an artifact of this type changes
   * @returns Unsubscribe function to remove this subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = engine.subscribeToType('skill', (event) => {
   *   console.log(`Skill ${event.artifactId} was ${event.type}`);
   * });
   * ```
   */
  subscribeToType(artifactType: ArtifactType, callback: ChangeSubscriber): Unsubscribe {
    return this.subscriptions.subscribeToType(artifactType, callback);
  }

  /**
   * Subscribe to changes for a specific artifact instance.
   *
   * @param artifactType - The artifact type
   * @param artifactId - The artifact identifier
   * @param callback - Function to call when this specific artifact changes
   * @returns Unsubscribe function to remove this subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = engine.subscribeToArtifact(
   *   'skill',
   *   'core/my-skill',
   *   (event) => {
   *     console.log(`my-skill was ${event.type}`);
   *   }
   * );
   * ```
   */
  subscribeToArtifact(
    artifactType: ArtifactType,
    artifactId: string,
    callback: ChangeSubscriber
  ): Unsubscribe {
    return this.subscriptions.subscribeToArtifact(artifactType, artifactId, callback);
  }

  /**
   * Get the subscription manager for advanced subscription operations.
   *
   * @returns The SubscriptionManager instance
   */
  getSubscriptionManager(): SubscriptionManager {
    return this.subscriptions;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a CrudEngine instance with preset configuration.
 *
 * @param projectRoot - The root directory of the project
 * @param mode - Engine mode: 'development' for verbose logging, 'production' for minimal
 * @returns A configured CrudEngine instance
 *
 * @example
 * ```typescript
 * // Development mode with full logging
 * const devEngine = createCrudEngine('/path/to/project', 'development');
 *
 * // Production mode with minimal logging
 * const prodEngine = createCrudEngine('/path/to/project', 'production');
 *
 * // Default (development mode)
 * const engine = createCrudEngine('/path/to/project');
 * ```
 */
export function createCrudEngine(
  projectRoot: string,
  mode: EngineMode = 'development'
): CrudEngine {
  const config = mode === 'production' ? PROD_CONFIG : DEV_CONFIG;
  return new CrudEngine(projectRoot, config);
}

// ============================================================================
// Exports
// ============================================================================

export { DEV_CONFIG, PROD_CONFIG };
