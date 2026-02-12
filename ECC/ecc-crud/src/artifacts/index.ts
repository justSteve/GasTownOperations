/**
 * @module artifacts
 * @description Artifact handlers for CRUD operations
 *
 * Each artifact type has a dedicated handler that implements the
 * ArtifactHandler interface for Create, Read, Update, Delete operations.
 *
 * @packageDocumentation
 */

// Handler interface and shared utilities
export { type ArtifactHandler, getSettingsPath } from './hook-handler.js';

// Aggregated handlers (stored in settings.json)
export { hookHandler } from './hook-handler.js';
export { mcpServerHandler } from './mcp-server-handler.js';

// File-per-entity handlers
export { skillHandler } from './skill-handler.js';
export { ruleHandler } from './rule-handler.js';
export { subAgentHandler } from './subagent-handler.js';
export { agentHandler } from './agent-handler.js';
export { commandHandler } from './command-handler.js';
