/**
 * Event System for ECC Orchestrator
 *
 * Provides type-safe event emission and handling for all engine events.
 *
 * @example
 * ```typescript
 * import { createEventEmitter } from '@ecc/orchestrator';
 *
 * const emitter = createEventEmitter();
 *
 * // Type-safe event handling
 * emitter.on('engine:initialized', (data) => {
 *   console.log(`Engine initialized for project: ${data.projectId}`);
 * });
 *
 * // Emit with type checking
 * emitter.emit('engine:initialized', {
 *   projectId: 'my-project',
 *   features: { hooks: true, tools: true }
 * });
 * ```
 */

// Event types and data structures
export type {
  EngineEventType,
  EventDataMap,
  EventError,
  EngineEvent,
  EngineEventHandler,
  GenericEventHandler,
} from './event-types.js';

export {
  ENGINE_EVENT_TYPES,
  isEngineEventType,
  isEngineEvent,
} from './event-types.js';

// Event emitter
export type {
  EngineEventEmitter,
  EventEmitterOptions,
} from './event-emitter.js';

export {
  createEventEmitter,
  waitForEvent,
  createFilteredEmitter,
} from './event-emitter.js';
