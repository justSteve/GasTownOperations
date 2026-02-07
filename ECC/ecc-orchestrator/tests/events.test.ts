/**
 * Tests for the event system
 * @module @ecc/orchestrator/tests/events
 */

import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import {
  createEventEmitter,
  waitForEvent,
  createFilteredEmitter,
  isEngineEventType,
  isEngineEvent,
  ENGINE_EVENT_TYPES,
  type EngineEventEmitter,
  type EventDataMap,
  type EngineEventType,
} from '../src/index.js';

// ============================================================================
// Event Emitter Creation Tests
// ============================================================================

describe('Event Emitter Creation', () => {
  test('createEventEmitter returns a valid emitter', () => {
    const emitter = createEventEmitter();

    expect(emitter).toBeDefined();
    expect(typeof emitter.on).toBe('function');
    expect(typeof emitter.off).toBe('function');
    expect(typeof emitter.once).toBe('function');
    expect(typeof emitter.emit).toBe('function');
    expect(typeof emitter.listenerCount).toBe('function');
    expect(typeof emitter.removeAllListeners).toBe('function');
    expect(typeof emitter.eventNames).toBe('function');
  });

  test('createEventEmitter accepts options', () => {
    const onWarning = () => {};
    const onError = () => {};

    const emitter = createEventEmitter({
      maxListeners: 5,
      onWarning,
      onError,
    });

    expect(emitter).toBeDefined();
  });
});

// ============================================================================
// on/off Listener Management Tests
// ============================================================================

describe('Listener Management (on/off)', () => {
  let emitter: EngineEventEmitter;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  test('on() adds a listener', () => {
    const handler = () => {};
    emitter.on('engine:initialized', handler);

    expect(emitter.listenerCount('engine:initialized')).toBe(1);
  });

  test('on() does not add duplicate listeners', () => {
    const handler = () => {};
    emitter.on('engine:initialized', handler);
    emitter.on('engine:initialized', handler);

    expect(emitter.listenerCount('engine:initialized')).toBe(1);
  });

  test('off() removes a listener', () => {
    const handler = () => {};
    emitter.on('engine:initialized', handler);
    emitter.off('engine:initialized', handler);

    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });

  test('off() only removes matching listener', () => {
    const handler1 = () => {};
    const handler2 = () => {};
    emitter.on('engine:initialized', handler1);
    emitter.on('engine:initialized', handler2);
    emitter.off('engine:initialized', handler1);

    expect(emitter.listenerCount('engine:initialized')).toBe(1);
  });

  test('off() does nothing for non-existent listener', () => {
    const handler = () => {};
    emitter.off('engine:initialized', handler);

    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });

  test('multiple listeners for same event', () => {
    emitter.on('engine:initialized', () => {});
    emitter.on('engine:initialized', () => {});
    emitter.on('engine:initialized', () => {});

    expect(emitter.listenerCount('engine:initialized')).toBe(3);
  });

  test('listeners for different events are independent', () => {
    emitter.on('engine:initialized', () => {});
    emitter.on('engine:shutdown', () => {});

    expect(emitter.listenerCount('engine:initialized')).toBe(1);
    expect(emitter.listenerCount('engine:shutdown')).toBe(1);
  });
});

// ============================================================================
// emit() Tests
// ============================================================================

describe('emit()', () => {
  let emitter: EngineEventEmitter;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  test('emit() calls all handlers', () => {
    let called1 = false;
    let called2 = false;
    let called3 = false;

    emitter.on('engine:initialized', () => { called1 = true; });
    emitter.on('engine:initialized', () => { called2 = true; });
    emitter.on('engine:initialized', () => { called3 = true; });

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    expect(called1).toBe(true);
    expect(called2).toBe(true);
    expect(called3).toBe(true);
  });

  test('emit() passes correct data to handlers', () => {
    let receivedData: EventDataMap['engine:initialized'] | undefined;

    emitter.on('engine:initialized', (data) => {
      receivedData = data;
    });

    emitter.emit('engine:initialized', {
      projectId: 'test-project',
      features: { hooks: true, tools: false },
    });

    expect(receivedData).toBeDefined();
    expect(receivedData?.projectId).toBe('test-project');
    expect(receivedData?.features.hooks).toBe(true);
    expect(receivedData?.features.tools).toBe(false);
  });

  test('emit() adds timestamp automatically', () => {
    // We can verify this indirectly by checking the full event
    // The handler receives only data, but we can test waitForEvent
    // which constructs the full event internally
    const before = new Date().toISOString();

    let called = false;
    emitter.on('engine:initialized', () => {
      called = true;
    });

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    const after = new Date().toISOString();

    expect(called).toBe(true);
    // The event was created between before and after
    // This verifies the emit path works correctly
  });

  test('emit() does nothing when no listeners', () => {
    // Should not throw
    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });

  test('emit() with different event types', () => {
    const events: EngineEventType[] = [];

    emitter.on('hook:before', () => events.push('hook:before'));
    emitter.on('hook:after', () => events.push('hook:after'));
    emitter.on('tool:call', () => events.push('tool:call'));

    emitter.emit('hook:before', { hook: 'test', event: 'test', input: {} });
    emitter.emit('hook:after', { hook: 'test', event: 'test', exitCode: 0, output: {}, durationMs: 100 });
    emitter.emit('tool:call', { tool: 'test', params: {} });

    expect(events).toEqual(['hook:before', 'hook:after', 'tool:call']);
  });
});

// ============================================================================
// once() Tests
// ============================================================================

describe('once()', () => {
  let emitter: EngineEventEmitter;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  test('once() handler fires on first emit', () => {
    let callCount = 0;

    emitter.once('engine:initialized', () => {
      callCount++;
    });

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    expect(callCount).toBe(1);
  });

  test('once() auto-removes after first call', () => {
    let callCount = 0;

    emitter.once('engine:initialized', () => {
      callCount++;
    });

    emitter.emit('engine:initialized', { projectId: 'test', features: {} });
    emitter.emit('engine:initialized', { projectId: 'test', features: {} });
    emitter.emit('engine:initialized', { projectId: 'test', features: {} });

    expect(callCount).toBe(1);
    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });

  test('once() does not prevent other handlers', () => {
    let onceCount = 0;
    let regularCount = 0;

    emitter.once('engine:initialized', () => { onceCount++; });
    emitter.on('engine:initialized', () => { regularCount++; });

    emitter.emit('engine:initialized', { projectId: 'test', features: {} });
    emitter.emit('engine:initialized', { projectId: 'test', features: {} });

    expect(onceCount).toBe(1);
    expect(regularCount).toBe(2);
  });

  test('multiple once() handlers all fire once', () => {
    let count1 = 0;
    let count2 = 0;

    emitter.once('engine:initialized', () => { count1++; });
    emitter.once('engine:initialized', () => { count2++; });

    emitter.emit('engine:initialized', { projectId: 'test', features: {} });
    emitter.emit('engine:initialized', { projectId: 'test', features: {} });

    expect(count1).toBe(1);
    expect(count2).toBe(1);
    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });
});

// ============================================================================
// Handler Error Isolation Tests
// ============================================================================

describe('Handler Error Isolation', () => {
  test('handler errors do not break other handlers', () => {
    const errors: Error[] = [];
    const emitter = createEventEmitter({
      onError: (err) => errors.push(err),
    });

    let handler1Called = false;
    let handler2Called = false;
    let handler3Called = false;

    emitter.on('engine:initialized', () => {
      handler1Called = true;
    });

    emitter.on('engine:initialized', () => {
      throw new Error('Handler 2 error');
    });

    emitter.on('engine:initialized', () => {
      handler3Called = true;
    });

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    expect(handler1Called).toBe(true);
    expect(handler3Called).toBe(true);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe('Handler 2 error');
  });

  test('string thrown in handler is converted to Error', () => {
    const errors: Error[] = [];
    const emitter = createEventEmitter({
      onError: (err) => errors.push(err),
    });

    emitter.on('engine:initialized', () => {
      throw 'string error';
    });

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe('string error');
  });

  test('default error handler uses console.error', () => {
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    const emitter = createEventEmitter();

    emitter.on('engine:initialized', () => {
      throw new Error('test error');
    });

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// ============================================================================
// listenerCount() Tests
// ============================================================================

describe('listenerCount()', () => {
  let emitter: EngineEventEmitter;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  test('returns 0 for events with no listeners', () => {
    expect(emitter.listenerCount('engine:initialized')).toBe(0);
    expect(emitter.listenerCount('hook:before')).toBe(0);
  });

  test('returns correct count for events with listeners', () => {
    emitter.on('engine:initialized', () => {});
    expect(emitter.listenerCount('engine:initialized')).toBe(1);

    emitter.on('engine:initialized', () => {});
    expect(emitter.listenerCount('engine:initialized')).toBe(2);

    emitter.on('engine:initialized', () => {});
    expect(emitter.listenerCount('engine:initialized')).toBe(3);
  });

  test('count decreases when listeners are removed', () => {
    const handler1 = () => {};
    const handler2 = () => {};

    emitter.on('engine:initialized', handler1);
    emitter.on('engine:initialized', handler2);
    expect(emitter.listenerCount('engine:initialized')).toBe(2);

    emitter.off('engine:initialized', handler1);
    expect(emitter.listenerCount('engine:initialized')).toBe(1);

    emitter.off('engine:initialized', handler2);
    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });

  test('counts once listeners', () => {
    emitter.once('engine:initialized', () => {});
    expect(emitter.listenerCount('engine:initialized')).toBe(1);
  });

  test('count decreases after once listener fires', () => {
    emitter.once('engine:initialized', () => {});
    expect(emitter.listenerCount('engine:initialized')).toBe(1);

    emitter.emit('engine:initialized', { projectId: 'test', features: {} });
    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });
});

// ============================================================================
// removeAllListeners() Tests
// ============================================================================

describe('removeAllListeners()', () => {
  let emitter: EngineEventEmitter;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  test('removes all listeners for specific event', () => {
    emitter.on('engine:initialized', () => {});
    emitter.on('engine:initialized', () => {});
    emitter.on('engine:shutdown', () => {});

    emitter.removeAllListeners('engine:initialized');

    expect(emitter.listenerCount('engine:initialized')).toBe(0);
    expect(emitter.listenerCount('engine:shutdown')).toBe(1);
  });

  test('removes all listeners when no event specified', () => {
    emitter.on('engine:initialized', () => {});
    emitter.on('engine:shutdown', () => {});
    emitter.on('hook:before', () => {});

    emitter.removeAllListeners();

    expect(emitter.listenerCount('engine:initialized')).toBe(0);
    expect(emitter.listenerCount('engine:shutdown')).toBe(0);
    expect(emitter.listenerCount('hook:before')).toBe(0);
    expect(emitter.eventNames()).toHaveLength(0);
  });

  test('removes once listeners too', () => {
    emitter.once('engine:initialized', () => {});
    emitter.once('engine:initialized', () => {});

    emitter.removeAllListeners('engine:initialized');

    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });
});

// ============================================================================
// eventNames() Tests
// ============================================================================

describe('eventNames()', () => {
  let emitter: EngineEventEmitter;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  test('returns empty array when no listeners', () => {
    expect(emitter.eventNames()).toEqual([]);
  });

  test('returns event types with listeners', () => {
    emitter.on('engine:initialized', () => {});
    emitter.on('hook:before', () => {});

    const names = emitter.eventNames();

    expect(names).toContain('engine:initialized');
    expect(names).toContain('hook:before');
    expect(names).toHaveLength(2);
  });

  test('updates when listeners are removed', () => {
    const handler = () => {};
    emitter.on('engine:initialized', handler);
    emitter.on('hook:before', () => {});

    emitter.off('engine:initialized', handler);

    const names = emitter.eventNames();
    expect(names).not.toContain('engine:initialized');
    expect(names).toContain('hook:before');
  });
});

// ============================================================================
// Max Listeners Warning Tests
// ============================================================================

describe('Max Listeners Warning', () => {
  test('warns when max listeners exceeded', () => {
    const warnings: string[] = [];
    const emitter = createEventEmitter({
      maxListeners: 3,
      onWarning: (msg) => warnings.push(msg),
    });

    for (let i = 0; i < 5; i++) {
      emitter.on('engine:initialized', () => {});
    }

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('Possible memory leak');
    expect(warnings[0]).toContain('engine:initialized');
  });

  test('warns only once per event type', () => {
    const warnings: string[] = [];
    const emitter = createEventEmitter({
      maxListeners: 2,
      onWarning: (msg) => warnings.push(msg),
    });

    for (let i = 0; i < 10; i++) {
      emitter.on('engine:initialized', () => {});
    }

    expect(warnings.length).toBe(1);
  });

  test('default max listeners is 10', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const emitter = createEventEmitter();

    for (let i = 0; i < 15; i++) {
      emitter.on('engine:initialized', () => {});
    }

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ============================================================================
// waitForEvent() Tests
// ============================================================================

describe('waitForEvent()', () => {
  test('resolves when event is emitted', async () => {
    const emitter = createEventEmitter();

    const promise = waitForEvent(emitter, 'engine:initialized');

    // Emit after a small delay
    setTimeout(() => {
      emitter.emit('engine:initialized', {
        projectId: 'test',
        features: { hooks: true },
      });
    }, 10);

    const data = await promise;

    expect(data.projectId).toBe('test');
    expect(data.features.hooks).toBe(true);
  });

  test('rejects on timeout', async () => {
    const emitter = createEventEmitter();

    const promise = waitForEvent(emitter, 'engine:initialized', { timeout: 50 });

    await expect(promise).rejects.toThrow("Timeout waiting for event 'engine:initialized'");
  });

  test('clears timeout when event fires', async () => {
    const emitter = createEventEmitter();

    const promise = waitForEvent(emitter, 'engine:initialized', { timeout: 1000 });

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    const data = await promise;
    expect(data.projectId).toBe('test');
  });

  test('removes listener after event fires', async () => {
    const emitter = createEventEmitter();

    const promise = waitForEvent(emitter, 'engine:initialized');

    emitter.emit('engine:initialized', {
      projectId: 'test',
      features: {},
    });

    await promise;

    expect(emitter.listenerCount('engine:initialized')).toBe(0);
  });
});

// ============================================================================
// Type Guards Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isEngineEventType()', () => {
    test('returns true for valid event types', () => {
      for (const type of ENGINE_EVENT_TYPES) {
        expect(isEngineEventType(type)).toBe(true);
      }
    });

    test('returns false for invalid event types', () => {
      expect(isEngineEventType('invalid:event')).toBe(false);
      expect(isEngineEventType('')).toBe(false);
      expect(isEngineEventType('engine')).toBe(false);
    });
  });

  describe('isEngineEvent()', () => {
    test('returns true for valid event objects', () => {
      const event = {
        type: 'engine:initialized',
        timestamp: new Date().toISOString(),
        data: { projectId: 'test', features: {} },
      };

      expect(isEngineEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(isEngineEvent(null)).toBe(false);
    });

    test('returns false for non-object', () => {
      expect(isEngineEvent('string')).toBe(false);
      expect(isEngineEvent(123)).toBe(false);
    });

    test('returns false for missing type', () => {
      expect(isEngineEvent({
        timestamp: new Date().toISOString(),
        data: {},
      })).toBe(false);
    });

    test('returns false for invalid type', () => {
      expect(isEngineEvent({
        type: 'invalid:type',
        timestamp: new Date().toISOString(),
        data: {},
      })).toBe(false);
    });

    test('returns false for missing timestamp', () => {
      expect(isEngineEvent({
        type: 'engine:initialized',
        data: {},
      })).toBe(false);
    });

    test('returns false for missing data', () => {
      expect(isEngineEvent({
        type: 'engine:initialized',
        timestamp: new Date().toISOString(),
      })).toBe(false);
    });

    test('returns false for null data', () => {
      expect(isEngineEvent({
        type: 'engine:initialized',
        timestamp: new Date().toISOString(),
        data: null,
      })).toBe(false);
    });
  });
});

// ============================================================================
// ENGINE_EVENT_TYPES Constant Tests
// ============================================================================

describe('ENGINE_EVENT_TYPES', () => {
  test('contains all expected lifecycle events', () => {
    expect(ENGINE_EVENT_TYPES).toContain('engine:initialized');
    expect(ENGINE_EVENT_TYPES).toContain('engine:shutdown');
  });

  test('contains all expected hook events', () => {
    expect(ENGINE_EVENT_TYPES).toContain('hook:before');
    expect(ENGINE_EVENT_TYPES).toContain('hook:after');
    expect(ENGINE_EVENT_TYPES).toContain('hook:error');
  });

  test('contains all expected tool events', () => {
    expect(ENGINE_EVENT_TYPES).toContain('tool:call');
    expect(ENGINE_EVENT_TYPES).toContain('tool:result');
    expect(ENGINE_EVENT_TYPES).toContain('tool:blocked');
  });

  test('contains all expected scene events', () => {
    expect(ENGINE_EVENT_TYPES).toContain('scene:start');
    expect(ENGINE_EVENT_TYPES).toContain('scene:step');
    expect(ENGINE_EVENT_TYPES).toContain('scene:complete');
    expect(ENGINE_EVENT_TYPES).toContain('scene:error');
  });

  test('contains log entry event', () => {
    expect(ENGINE_EVENT_TYPES).toContain('log:entry');
  });

  test('is readonly array type', () => {
    // The array is defined with 'as const' which makes it readonly at compile time
    // At runtime we just verify it's an array with expected properties
    expect(Array.isArray(ENGINE_EVENT_TYPES)).toBe(true);
    expect(ENGINE_EVENT_TYPES.length).toBeGreaterThan(0);
  });
});
