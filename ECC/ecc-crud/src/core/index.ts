/**
 * @fileoverview Core module exports
 *
 * The core module provides the main CrudEngine class and related types
 * for managing ECC artifact CRUD operations.
 *
 * @module @ecc/crud/core
 */

// Main CrudEngine class and factory
export {
  CrudEngine,
  createCrudEngine,
  DEV_CONFIG,
  PROD_CONFIG,
} from './crud-engine.js';

// Configuration types
export type {
  CrudEngineConfig,
  EngineMode,
  CreateOptions,
  ReadOptions,
  UpdateOptions,
  DeleteOptions,
} from './crud-engine.js';

// Subscription system
export {
  SubscriptionManager,
  createSubscriptionManager,
  computeFieldChanges,
} from './subscription.js';

// Subscription types
// Note: FieldChange is exported from versioning/history.js, not duplicated here
export type {
  ArtifactChangeType,
  ArtifactChangeEvent,
  ChangeSubscriber,
  Unsubscribe,
} from './subscription.js';
