/**
 * @fileoverview Change Subscription System for CRUD Engine
 *
 * Provides real-time change notification capability for artifact operations.
 * Enables components to subscribe to artifact changes at different granularities:
 * - Global: All changes across all artifact types
 * - Type: Changes to a specific artifact type
 * - Artifact: Changes to a specific artifact instance
 *
 * @module @ecc/crud/core/subscription
 */

import type { ArtifactType } from '../types/operation-types.js';
import type { FieldChange } from '../versioning/history.js';

// Re-export FieldChange for convenience
export type { FieldChange } from '../versioning/history.js';

// ============================================================================
// Change Event Types
// ============================================================================

/**
 * Type of change that occurred on an artifact.
 */
export type ArtifactChangeType = 'created' | 'updated' | 'deleted';

/**
 * Event emitted when an artifact changes.
 *
 * @typeParam T - The artifact type
 *
 * @example
 * ```typescript
 * // Created event
 * const createdEvent: ArtifactChangeEvent<EccSkill> = {
 *   type: 'created',
 *   artifactType: 'skill',
 *   artifactId: 'core/my-skill',
 *   timestamp: '2026-02-08T12:00:00.000Z',
 *   artifact: { ... },
 * };
 *
 * // Updated event
 * const updatedEvent: ArtifactChangeEvent<EccSkill> = {
 *   type: 'updated',
 *   artifactType: 'skill',
 *   artifactId: 'core/my-skill',
 *   timestamp: '2026-02-08T12:00:00.000Z',
 *   artifact: { ... },
 *   changes: [
 *     { field: 'description', oldValue: 'Old desc', newValue: 'New desc' },
 *   ],
 * };
 *
 * // Deleted event
 * const deletedEvent: ArtifactChangeEvent<EccSkill> = {
 *   type: 'deleted',
 *   artifactType: 'skill',
 *   artifactId: 'core/my-skill',
 *   timestamp: '2026-02-08T12:00:00.000Z',
 *   deletedArtifact: { ... },
 * };
 * ```
 */
export interface ArtifactChangeEvent<T = unknown> {
  /** Type of change that occurred */
  type: ArtifactChangeType;

  /** The artifact type that changed */
  artifactType: ArtifactType;

  /** The unique identifier of the artifact */
  artifactId: string;

  /** ISO 8601 timestamp of when the change occurred */
  timestamp: string;

  /** The artifact after change (for created/updated) */
  artifact?: T;

  /** Field-level changes (for updated) */
  changes?: FieldChange[];

  /** The artifact before deletion (for deleted) */
  deletedArtifact?: T;
}

// ============================================================================
// Subscriber Types
// ============================================================================

/**
 * Callback function invoked when an artifact changes.
 *
 * @typeParam T - The artifact type
 * @param event - The change event with details about what changed
 */
export type ChangeSubscriber<T = unknown> = (event: ArtifactChangeEvent<T>) => void;

/**
 * Function to unsubscribe from change notifications.
 * Call this to stop receiving events.
 */
export type Unsubscribe = () => void;

// ============================================================================
// Subscription Key Utilities
// ============================================================================

/** Key for global subscriptions (all changes) */
const GLOBAL_KEY = '*';

/**
 * Generate subscription key for type-level subscriptions.
 */
function typeKey(artifactType: ArtifactType): string {
  return `type:${artifactType}`;
}

/**
 * Generate subscription key for artifact-level subscriptions.
 */
function artifactKey(artifactType: ArtifactType, artifactId: string): string {
  return `artifact:${artifactType}:${artifactId}`;
}

// ============================================================================
// SubscriptionManager Class
// ============================================================================

/**
 * Manages subscriptions to artifact change events.
 *
 * Supports three levels of subscription granularity:
 * 1. **Global**: Subscribe to all changes across all artifact types
 * 2. **Type**: Subscribe to changes for a specific artifact type
 * 3. **Artifact**: Subscribe to changes for a specific artifact instance
 *
 * When an event is emitted, it notifies all matching subscribers in order:
 * global -> type -> artifact
 *
 * @example
 * ```typescript
 * const manager = new SubscriptionManager();
 *
 * // Subscribe to all changes
 * const unsubAll = manager.subscribe((event) => {
 *   console.log(`${event.type} on ${event.artifactType}:${event.artifactId}`);
 * });
 *
 * // Subscribe to skill changes only
 * const unsubSkills = manager.subscribeToType('skill', (event) => {
 *   console.log(`Skill ${event.artifactId} ${event.type}`);
 * });
 *
 * // Subscribe to a specific artifact
 * const unsubOne = manager.subscribeToArtifact('skill', 'core/my-skill', (event) => {
 *   console.log(`my-skill changed: ${event.type}`);
 * });
 *
 * // Later: unsubscribe
 * unsubAll();
 * unsubSkills();
 * unsubOne();
 * ```
 */
export class SubscriptionManager {
  /**
   * Map of subscription keys to sets of subscriber callbacks.
   *
   * Key formats:
   * - `*` - Global subscriptions
   * - `type:{artifactType}` - Type-level subscriptions
   * - `artifact:{artifactType}:{artifactId}` - Artifact-level subscriptions
   */
  private subscribers: Map<string, Set<ChangeSubscriber>>;

  /**
   * Create a new SubscriptionManager instance.
   */
  constructor() {
    this.subscribers = new Map();
  }

  // ==========================================================================
  // Subscription Methods
  // ==========================================================================

  /**
   * Subscribe to all artifact changes.
   *
   * The callback will be invoked for every change event across all
   * artifact types.
   *
   * @param callback - Function to call when any artifact changes
   * @returns Unsubscribe function to remove this subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = manager.subscribe((event) => {
   *   console.log(`${event.type}: ${event.artifactType}/${event.artifactId}`);
   * });
   *
   * // Stop listening
   * unsubscribe();
   * ```
   */
  subscribe(callback: ChangeSubscriber): Unsubscribe {
    return this.addSubscriber(GLOBAL_KEY, callback);
  }

  /**
   * Subscribe to changes for a specific artifact type.
   *
   * The callback will be invoked for every change event on artifacts
   * of the specified type.
   *
   * @param artifactType - The artifact type to subscribe to
   * @param callback - Function to call when an artifact of this type changes
   * @returns Unsubscribe function to remove this subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = manager.subscribeToType('skill', (event) => {
   *   console.log(`Skill ${event.artifactId} was ${event.type}`);
   * });
   * ```
   */
  subscribeToType(artifactType: ArtifactType, callback: ChangeSubscriber): Unsubscribe {
    return this.addSubscriber(typeKey(artifactType), callback);
  }

  /**
   * Subscribe to changes for a specific artifact instance.
   *
   * The callback will be invoked only when the specified artifact changes.
   *
   * @param artifactType - The artifact type
   * @param artifactId - The artifact identifier
   * @param callback - Function to call when this specific artifact changes
   * @returns Unsubscribe function to remove this subscription
   *
   * @example
   * ```typescript
   * const unsubscribe = manager.subscribeToArtifact(
   *   'skill',
   *   'core/my-skill',
   *   (event) => {
   *     console.log(`my-skill was ${event.type}`);
   *     if (event.type === 'updated' && event.changes) {
   *       event.changes.forEach(c => {
   *         console.log(`  ${c.field}: ${c.oldValue} -> ${c.newValue}`);
   *       });
   *     }
   *   }
   * );
   * ```
   */
  subscribeToArtifact(
    artifactType: ArtifactType,
    artifactId: string,
    callback: ChangeSubscriber
  ): Unsubscribe {
    return this.addSubscriber(artifactKey(artifactType, artifactId), callback);
  }

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  /**
   * Emit a change event to all matching subscribers.
   *
   * Notifies subscribers in this order:
   * 1. Global subscribers (subscribed via `subscribe()`)
   * 2. Type subscribers (subscribed via `subscribeToType()`)
   * 3. Artifact subscribers (subscribed via `subscribeToArtifact()`)
   *
   * If any subscriber throws an error, it is caught and logged to console,
   * but does not prevent other subscribers from being notified.
   *
   * @param event - The change event to emit
   *
   * @example
   * ```typescript
   * // Called internally by CrudEngine after operations
   * manager.emit({
   *   type: 'created',
   *   artifactType: 'skill',
   *   artifactId: 'core/new-skill',
   *   timestamp: new Date().toISOString(),
   *   artifact: newSkill,
   * });
   * ```
   */
  emit<T>(event: ArtifactChangeEvent<T>): void {
    // Collect all keys that should receive this event
    const keys = [
      GLOBAL_KEY,
      typeKey(event.artifactType),
      artifactKey(event.artifactType, event.artifactId),
    ];

    // Notify subscribers for each matching key
    for (const key of keys) {
      const subscriberSet = this.subscribers.get(key);
      if (subscriberSet) {
        for (const subscriber of subscriberSet) {
          try {
            subscriber(event as ArtifactChangeEvent);
          } catch (error) {
            // Log but don't throw - one subscriber shouldn't break others
            console.error(
              `[SubscriptionManager] Subscriber error for ${key}:`,
              error
            );
          }
        }
      }
    }
  }

  // ==========================================================================
  // Management Methods
  // ==========================================================================

  /**
   * Get the total number of active subscriptions.
   *
   * Useful for debugging and monitoring subscription leaks.
   *
   * @returns Total count of all subscribers across all keys
   *
   * @example
   * ```typescript
   * console.log(`Active subscriptions: ${manager.getSubscriberCount()}`);
   * ```
   */
  getSubscriberCount(): number {
    let count = 0;
    for (const subscriberSet of this.subscribers.values()) {
      count += subscriberSet.size;
    }
    return count;
  }

  /**
   * Get subscriber counts broken down by subscription level.
   *
   * @returns Object with counts for global, type, and artifact subscriptions
   */
  getSubscriberStats(): {
    global: number;
    byType: number;
    byArtifact: number;
    total: number;
  } {
    let global = 0;
    let byType = 0;
    let byArtifact = 0;

    for (const [key, subscriberSet] of this.subscribers.entries()) {
      const size = subscriberSet.size;
      if (key === GLOBAL_KEY) {
        global += size;
      } else if (key.startsWith('type:')) {
        byType += size;
      } else if (key.startsWith('artifact:')) {
        byArtifact += size;
      }
    }

    return {
      global,
      byType,
      byArtifact,
      total: global + byType + byArtifact,
    };
  }

  /**
   * Clear all subscriptions.
   *
   * Use with caution - this removes all subscribers. Primarily useful
   * for testing or cleanup during shutdown.
   *
   * @example
   * ```typescript
   * // During test cleanup
   * afterEach(() => {
   *   manager.clear();
   * });
   * ```
   */
  clear(): void {
    this.subscribers.clear();
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Add a subscriber to the specified key.
   *
   * @param key - The subscription key
   * @param callback - The subscriber callback
   * @returns Unsubscribe function
   */
  private addSubscriber(key: string, callback: ChangeSubscriber): Unsubscribe {
    // Get or create the subscriber set for this key
    let subscriberSet = this.subscribers.get(key);
    if (!subscriberSet) {
      subscriberSet = new Set();
      this.subscribers.set(key, subscriberSet);
    }

    // Add the callback
    subscriberSet.add(callback);

    // Return unsubscribe function
    return () => {
      const set = this.subscribers.get(key);
      if (set) {
        set.delete(callback);
        // Clean up empty sets to prevent memory leaks
        if (set.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new SubscriptionManager instance.
 *
 * @returns A new SubscriptionManager
 *
 * @example
 * ```typescript
 * const subscriptions = createSubscriptionManager();
 *
 * subscriptions.subscribe((event) => {
 *   console.log('Change:', event);
 * });
 * ```
 */
export function createSubscriptionManager(): SubscriptionManager {
  return new SubscriptionManager();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute field-level changes between two artifact states.
 *
 * Performs a shallow comparison of object properties to detect what changed.
 * For nested objects, the entire nested object is compared.
 *
 * @param before - The artifact state before the change
 * @param after - The artifact state after the change
 * @returns Array of field changes, or empty array if no changes detected
 *
 * @example
 * ```typescript
 * const changes = computeFieldChanges(
 *   { name: 'skill-a', description: 'Old' },
 *   { name: 'skill-a', description: 'New' }
 * );
 * // Result: [{ field: 'description', oldValue: 'Old', newValue: 'New' }]
 * ```
 */
export function computeFieldChanges<T extends Record<string, unknown>>(
  before: T,
  after: T
): FieldChange[] {
  const changes: FieldChange[] = [];

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const oldValue = before[key];
    const newValue = after[key];

    // Deep equality check for objects/arrays
    if (!isEqual(oldValue, newValue)) {
      changes.push({
        field: key,
        oldValue,
        newValue,
      });
    }
  }

  return changes;
}

/**
 * Simple deep equality check.
 *
 * Handles primitives, arrays, objects, null, and undefined.
 */
function isEqual(a: unknown, b: unknown): boolean {
  // Same reference or same primitive value
  if (a === b) return true;

  // Handle null/undefined
  if (a == null || b == null) return a === b;

  // Different types
  if (typeof a !== typeof b) return false;

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isEqual(item, b[index]));
  }

  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key) => isEqual(aObj[key], bObj[key]));
  }

  // Primitives that are not equal
  return false;
}
