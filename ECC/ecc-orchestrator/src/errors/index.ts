/**
 * Error handling subsystem for @ecc/orchestrator
 *
 * Exports:
 * - Error types: Hierarchical error classes for different failure modes
 * - Error handlers: Utilities for wrapping, enriching, and inspecting errors
 */

// Error types and interfaces
export type { ErrorContext, ErrorJSON } from './error-types.js';
export {
  // Base class
  OrchestrationError,
  // Configuration errors (fail fast)
  ConfigurationError,
  EntityNotFoundError,
  InvalidConfigError,
  CircularDependencyError,
  // Runtime errors (may be recoverable)
  RuntimeError,
  HookExecutionError,
  TimeoutError,
  ToolBlockedError,
  // Integration errors (external systems)
  IntegrationError,
  BeadsError,
  MailError,
  TmuxError,
  // Scene errors (Explorer-specific)
  SceneError,
  PrerequisiteError,
  TakeError,
} from './error-types.js';

// Error handling utilities
export {
  wrapError,
  enrichError,
  formatStack,
  isOrchestrationError,
  getErrorChain,
  hasErrorInChain,
  findErrorInChain,
  getRootCause,
} from './error-handler.js';
