/**
 * Traffic logging module
 *
 * CRUD traffic logging capabilities for observability.
 * Integrates with @ecc/orchestrator logging subsystem.
 *
 * @module @ecc/crud/logging
 */

export {
  // Types
  type LogContext,
  type Logger,
  type TrafficLogEntry,
  type TrafficLoggingContext,
  type TrafficLogger,
  // Functions
  generateOperationId,
  createTrafficLogger,
  withTrafficLogging,
} from './traffic-logger.js';

export const LOGGING_VERSION = '0.1.0';
