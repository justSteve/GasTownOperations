/**
 * Explorer Module - Claude Code Explorer Engine
 *
 * Provides scene loading, configuration generation, execution, and event streaming
 * for the Claude Code Explorer sandbox application.
 */

// Types
export * from './types.js';

// Scene loading
export {
  loadScene,
  loadScenesFromDirectory,
  resolveParameters,
  applyVariation,
  groupScenesByAct,
} from './scene-loader.js';

// Configuration generation
export {
  generateConfig,
  cleanupConfig,
  type ConfigGeneratorOptions,
} from './config-generator.js';

// Execution
export {
  SceneExecutor,
  createExecutor,
  type ExecutorOptions,
} from './executor.js';

// Event streaming
export {
  EventStreamServer,
  createEventStream,
  ConsoleEventLogger,
  createConsoleLogger,
  type EventStreamOptions,
  type StreamEvent,
} from './event-stream.js';
