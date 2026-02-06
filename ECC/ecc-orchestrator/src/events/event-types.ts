/**
 * Event Types for ECC Orchestrator
 *
 * Type-safe event definitions for all engine events including lifecycle,
 * hook execution, tool observability, scene execution, and log streaming.
 */

// ============================================================================
// Event Type Literals
// ============================================================================

/**
 * All engine event types as a discriminated union.
 */
export type EngineEventType =
  // Lifecycle events
  | 'engine:initialized'
  | 'engine:shutdown'
  // Hook execution events
  | 'hook:before'
  | 'hook:after'
  | 'hook:error'
  // Tool observability events
  | 'tool:call'
  | 'tool:result'
  | 'tool:blocked'
  // Scene execution events (Explorer)
  | 'scene:start'
  | 'scene:step'
  | 'scene:complete'
  | 'scene:error'
  // Log streaming events
  | 'log:entry';

// ============================================================================
// Event Data Structures
// ============================================================================

/**
 * Error information included in error events.
 */
export interface EventError {
  code: string;
  message: string;
}

/**
 * Type-safe mapping from event type to its data structure.
 */
export interface EventDataMap {
  // Lifecycle
  'engine:initialized': {
    projectId: string;
    features: Record<string, boolean>;
  };
  'engine:shutdown': {
    reason?: string;
  };

  // Hook execution
  'hook:before': {
    hook: string;
    event: string;
    input: unknown;
  };
  'hook:after': {
    hook: string;
    event: string;
    exitCode: number;
    output: unknown;
    durationMs: number;
  };
  'hook:error': {
    hook: string;
    event: string;
    error: EventError;
  };

  // Tool observability
  'tool:call': {
    tool: string;
    params: unknown;
  };
  'tool:result': {
    tool: string;
    result: unknown;
    durationMs: number;
  };
  'tool:blocked': {
    tool: string;
    reason: string;
  };

  // Scene execution (Explorer)
  'scene:start': {
    sceneId: string;
    actId: string;
    parameters: Record<string, unknown>;
  };
  'scene:step': {
    sceneId: string;
    step: number;
    action: string;
    commentary?: string;
  };
  'scene:complete': {
    sceneId: string;
    durationMs: number;
    stepsCompleted: number;
  };
  'scene:error': {
    sceneId: string;
    step: number;
    error: EventError;
  };

  // Log streaming
  'log:entry': {
    timestamp: string;
    level: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

// ============================================================================
// Event Wrapper Types
// ============================================================================

/**
 * Typed event wrapper containing type, timestamp, and typed data.
 */
export interface EngineEvent<T extends EngineEventType> {
  type: T;
  timestamp: string;
  data: EventDataMap[T];
}

/**
 * Handler function type for a specific event type.
 */
export type EngineEventHandler<T extends EngineEventType> = (
  data: EventDataMap[T]
) => void;

/**
 * Generic handler that can receive any event type.
 * Useful for logging or forwarding all events.
 */
export type GenericEventHandler = <T extends EngineEventType>(
  event: EngineEvent<T>
) => void;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * All valid event type strings for runtime validation.
 */
export const ENGINE_EVENT_TYPES: readonly EngineEventType[] = [
  'engine:initialized',
  'engine:shutdown',
  'hook:before',
  'hook:after',
  'hook:error',
  'tool:call',
  'tool:result',
  'tool:blocked',
  'scene:start',
  'scene:step',
  'scene:complete',
  'scene:error',
  'log:entry',
] as const;

/**
 * Type guard to check if a string is a valid EngineEventType.
 */
export function isEngineEventType(value: string): value is EngineEventType {
  return ENGINE_EVENT_TYPES.includes(value as EngineEventType);
}

/**
 * Type guard to validate an EngineEvent structure.
 */
export function isEngineEvent<T extends EngineEventType>(
  value: unknown
): value is EngineEvent<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (
    typeof event.type === 'string' &&
    isEngineEventType(event.type) &&
    typeof event.timestamp === 'string' &&
    typeof event.data === 'object' &&
    event.data !== null
  );
}
