/**
 * Error class hierarchy for @ecc/orchestrator
 *
 * Categories:
 * - ConfigurationError: Fail fast on invalid config (non-recoverable)
 * - RuntimeError: May be recoverable during execution
 * - IntegrationError: External system failures
 * - SceneError: Explorer-specific scene orchestration errors
 */

/**
 * Contextual information attached to errors for debugging and logging
 */
export interface ErrorContext {
  agentName?: string | undefined;
  hookName?: string | undefined;
  sceneId?: string | undefined;
  phase?: string | undefined;
  [key: string]: unknown;
}

/**
 * Serializable error representation for logging and transmission
 */
export interface ErrorJSON {
  code: string;
  message: string;
  context?: ErrorContext | undefined;
  cause?: ErrorJSON | undefined;
  stack?: string | undefined;
}

/**
 * Base class for all orchestration errors
 *
 * Provides structured error information with:
 * - Error codes for programmatic handling
 * - Optional context for debugging
 * - Error chaining via cause
 * - JSON serialization for logging
 */
export abstract class OrchestrationError extends Error {
  abstract readonly code: string;
  readonly context: ErrorContext | undefined;
  override readonly cause: Error | undefined;

  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.cause = cause;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace, excluding constructor
    // captureStackTrace is V8-specific, check before calling
    const ErrorWithCaptureStackTrace = Error as typeof Error & {
      captureStackTrace?: (
        targetObject: object,
        constructorOpt?: Function
      ) => void;
    };
    if (typeof ErrorWithCaptureStackTrace.captureStackTrace === 'function') {
      ErrorWithCaptureStackTrace.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error to JSON including the full cause chain
   */
  toJSON(): ErrorJSON {
    const json: ErrorJSON = {
      code: this.code,
      message: this.message,
    };

    if (this.context !== undefined && Object.keys(this.context).length > 0) {
      json.context = this.context;
    }

    if (this.cause) {
      if (this.cause instanceof OrchestrationError) {
        json.cause = this.cause.toJSON();
      } else {
        const causeJson: ErrorJSON = {
          code: 'UNKNOWN_ERROR',
          message: this.cause.message,
        };
        if (this.cause.stack !== undefined) {
          causeJson.stack = this.cause.stack;
        }
        json.cause = causeJson;
      }
    }

    if (this.stack !== undefined) {
      json.stack = this.stack;
    }

    return json;
  }
}

// =============================================================================
// Configuration Errors (fail fast - non-recoverable)
// =============================================================================

/**
 * Base class for configuration-related errors
 * These indicate problems that should be caught at startup/validation time
 */
export class ConfigurationError extends OrchestrationError {
  readonly code: string = 'CONFIGURATION_ERROR';
}

/**
 * Thrown when a referenced entity (agent, skill, hook) cannot be found
 */
export class EntityNotFoundError extends ConfigurationError {
  override readonly code: string = 'ENTITY_NOT_FOUND';
  readonly entityType: string;
  readonly entityId: string;

  constructor(
    entityType: string,
    entityId: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(`${entityType} not found: ${entityId}`, context, cause);
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

/**
 * Thrown when configuration values are invalid
 */
export class InvalidConfigError extends ConfigurationError {
  override readonly code: string = 'INVALID_CONFIG';
  readonly field: string;
  readonly reason: string;

  constructor(
    field: string,
    reason: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(`Invalid config for '${field}': ${reason}`, context, cause);
    this.field = field;
    this.reason = reason;
  }
}

/**
 * Thrown when circular dependencies are detected in entity graph
 */
export class CircularDependencyError extends ConfigurationError {
  override readonly code: string = 'CIRCULAR_DEPENDENCY';
  readonly path: string[];

  constructor(path: string[], context?: ErrorContext, cause?: Error) {
    super(`Circular dependency detected: ${path.join(' -> ')}`, context, cause);
    this.path = path;
  }
}

// =============================================================================
// Runtime Errors (may be recoverable)
// =============================================================================

/**
 * Base class for runtime errors that may be recoverable
 */
export class RuntimeError extends OrchestrationError {
  readonly code: string = 'RUNTIME_ERROR';
}

/**
 * Thrown when a hook script fails during execution
 */
export class HookExecutionError extends RuntimeError {
  override readonly code: string = 'HOOK_EXECUTION_ERROR';
  readonly exitCode: number | undefined;
  readonly stderr: string | undefined;

  constructor(
    message: string,
    options: {
      exitCode?: number;
      stderr?: string;
      context?: ErrorContext;
      cause?: Error;
    } = {}
  ) {
    super(message, options.context, options.cause);
    this.exitCode = options.exitCode;
    this.stderr = options.stderr;
  }
}

/**
 * Thrown when an operation exceeds its time limit
 */
export class TimeoutError extends RuntimeError {
  override readonly code: string = 'TIMEOUT_ERROR';
  readonly timeoutMs: number;

  constructor(
    message: string,
    timeoutMs: number,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(message, context, cause);
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Thrown when a tool invocation is blocked by policy
 */
export class ToolBlockedError extends RuntimeError {
  override readonly code: string = 'TOOL_BLOCKED';
  readonly tool: string;
  readonly reason: string;

  constructor(
    tool: string,
    reason: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(`Tool '${tool}' blocked: ${reason}`, context, cause);
    this.tool = tool;
    this.reason = reason;
  }
}

// =============================================================================
// Integration Errors (external system failures)
// =============================================================================

/**
 * Base class for external system integration failures
 */
export class IntegrationError extends OrchestrationError {
  readonly code: string = 'INTEGRATION_ERROR';
}

/**
 * Thrown when Beads subsystem operations fail
 */
export class BeadsError extends IntegrationError {
  override readonly code: string = 'BEADS_ERROR';

  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message, context, cause);
  }
}

/**
 * Thrown when Mail subsystem operations fail
 */
export class MailError extends IntegrationError {
  override readonly code: string = 'MAIL_ERROR';

  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message, context, cause);
  }
}

/**
 * Thrown when tmux operations fail
 */
export class TmuxError extends IntegrationError {
  override readonly code: string = 'TMUX_ERROR';

  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message, context, cause);
  }
}

// =============================================================================
// Scene Errors (Explorer-specific)
// =============================================================================

/**
 * Base class for scene orchestration errors
 */
export class SceneError extends OrchestrationError {
  readonly code: string = 'SCENE_ERROR';
}

/**
 * Thrown when scene prerequisites are not satisfied
 */
export class PrerequisiteError extends SceneError {
  override readonly code: string = 'PREREQUISITE_ERROR';
  readonly missingScenes: string[];

  constructor(
    missingScenes: string[],
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      `Missing prerequisite scenes: ${missingScenes.join(', ')}`,
      context,
      cause
    );
    this.missingScenes = missingScenes;
  }
}

/**
 * Thrown when a take (scene attempt) fails
 */
export class TakeError extends SceneError {
  override readonly code: string = 'TAKE_ERROR';
  readonly takeId: string;

  constructor(
    takeId: string,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(`Take ${takeId} failed: ${message}`, context, cause);
    this.takeId = takeId;
  }
}
