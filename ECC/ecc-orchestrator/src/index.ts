/**
 * @ecc/orchestrator - Agent Orchestration Engine
 *
 * Reusable engine for managing Claude Code entities (skills, hooks, sub-agents).
 * Serves Explorer sandbox, DReader agents, ParseClipmate, and future projects.
 */

// Logging subsystem
export * from './logging/types.js';
export * from './logging/logger.js';
export * from './logging/formatters/index.js';
export * from './logging/transports/index.js';

// Error handling
export * from './errors/error-types.js';
export * from './errors/error-handler.js';

// Event system
export * from './events/event-types.js';
export * from './events/event-emitter.js';

// Explorer engine
export * from './explorer/index.js';
