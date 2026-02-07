/**
 * Tests for error handling subsystem
 * @module @ecc/orchestrator/tests/errors
 */

import { describe, test, expect } from 'bun:test';
import {
  // Base and category errors
  OrchestrationError,
  ConfigurationError,
  RuntimeError,
  IntegrationError,
  SceneError,
  // Specific error types
  EntityNotFoundError,
  InvalidConfigError,
  CircularDependencyError,
  HookExecutionError,
  TimeoutError,
  ToolBlockedError,
  BeadsError,
  MailError,
  TmuxError,
  PrerequisiteError,
  TakeError,
  // Utilities
  wrapError,
  enrichError,
  isOrchestrationError,
  getErrorChain,
  getRootCause,
  hasErrorInChain,
  findErrorInChain,
  formatStack,
  type ErrorContext,
  type ErrorJSON,
} from '../src/index.js';

// ============================================================================
// Error Type Code Tests
// ============================================================================

describe('Error Types Have Correct Codes', () => {
  test('ConfigurationError has CONFIGURATION_ERROR code', () => {
    const error = new ConfigurationError('test');
    expect(error.code).toBe('CONFIGURATION_ERROR');
  });

  test('EntityNotFoundError has ENTITY_NOT_FOUND code', () => {
    const error = new EntityNotFoundError('agent', 'test-agent');
    expect(error.code).toBe('ENTITY_NOT_FOUND');
    expect(error.entityType).toBe('agent');
    expect(error.entityId).toBe('test-agent');
    expect(error.message).toBe('agent not found: test-agent');
  });

  test('InvalidConfigError has INVALID_CONFIG code', () => {
    const error = new InvalidConfigError('timeout', 'must be positive');
    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.field).toBe('timeout');
    expect(error.reason).toBe('must be positive');
    expect(error.message).toBe("Invalid config for 'timeout': must be positive");
  });

  test('CircularDependencyError has CIRCULAR_DEPENDENCY code', () => {
    const error = new CircularDependencyError(['A', 'B', 'C', 'A']);
    expect(error.code).toBe('CIRCULAR_DEPENDENCY');
    expect(error.path).toEqual(['A', 'B', 'C', 'A']);
    expect(error.message).toBe('Circular dependency detected: A -> B -> C -> A');
  });

  test('RuntimeError has RUNTIME_ERROR code', () => {
    const error = new RuntimeError('test');
    expect(error.code).toBe('RUNTIME_ERROR');
  });

  test('HookExecutionError has HOOK_EXECUTION_ERROR code', () => {
    const error = new HookExecutionError('hook failed', {
      exitCode: 1,
      stderr: 'error output',
    });
    expect(error.code).toBe('HOOK_EXECUTION_ERROR');
    expect(error.exitCode).toBe(1);
    expect(error.stderr).toBe('error output');
  });

  test('TimeoutError has TIMEOUT_ERROR code', () => {
    const error = new TimeoutError('operation timed out', 5000);
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.timeoutMs).toBe(5000);
  });

  test('ToolBlockedError has TOOL_BLOCKED code', () => {
    const error = new ToolBlockedError('rm', 'not allowed in sandbox');
    expect(error.code).toBe('TOOL_BLOCKED');
    expect(error.tool).toBe('rm');
    expect(error.reason).toBe('not allowed in sandbox');
    expect(error.message).toBe("Tool 'rm' blocked: not allowed in sandbox");
  });

  test('IntegrationError has INTEGRATION_ERROR code', () => {
    const error = new IntegrationError('test');
    expect(error.code).toBe('INTEGRATION_ERROR');
  });

  test('BeadsError has BEADS_ERROR code', () => {
    const error = new BeadsError('beads failed');
    expect(error.code).toBe('BEADS_ERROR');
  });

  test('MailError has MAIL_ERROR code', () => {
    const error = new MailError('mail failed');
    expect(error.code).toBe('MAIL_ERROR');
  });

  test('TmuxError has TMUX_ERROR code', () => {
    const error = new TmuxError('tmux failed');
    expect(error.code).toBe('TMUX_ERROR');
  });

  test('SceneError has SCENE_ERROR code', () => {
    const error = new SceneError('test');
    expect(error.code).toBe('SCENE_ERROR');
  });

  test('PrerequisiteError has PREREQUISITE_ERROR code', () => {
    const error = new PrerequisiteError(['scene-a', 'scene-b']);
    expect(error.code).toBe('PREREQUISITE_ERROR');
    expect(error.missingScenes).toEqual(['scene-a', 'scene-b']);
    expect(error.message).toBe('Missing prerequisite scenes: scene-a, scene-b');
  });

  test('TakeError has TAKE_ERROR code', () => {
    const error = new TakeError('take-123', 'assertion failed');
    expect(error.code).toBe('TAKE_ERROR');
    expect(error.takeId).toBe('take-123');
    expect(error.message).toBe('Take take-123 failed: assertion failed');
  });
});

// ============================================================================
// Error Inheritance Tests
// ============================================================================

describe('Error Inheritance Hierarchy', () => {
  test('all errors extend OrchestrationError', () => {
    expect(new ConfigurationError('test')).toBeInstanceOf(OrchestrationError);
    expect(new RuntimeError('test')).toBeInstanceOf(OrchestrationError);
    expect(new IntegrationError('test')).toBeInstanceOf(OrchestrationError);
    expect(new SceneError('test')).toBeInstanceOf(OrchestrationError);
  });

  test('specific errors extend their category', () => {
    expect(new EntityNotFoundError('a', 'b')).toBeInstanceOf(ConfigurationError);
    expect(new InvalidConfigError('a', 'b')).toBeInstanceOf(ConfigurationError);
    expect(new CircularDependencyError(['a'])).toBeInstanceOf(ConfigurationError);

    expect(new HookExecutionError('test')).toBeInstanceOf(RuntimeError);
    expect(new TimeoutError('test', 1000)).toBeInstanceOf(RuntimeError);
    expect(new ToolBlockedError('a', 'b')).toBeInstanceOf(RuntimeError);

    expect(new BeadsError('test')).toBeInstanceOf(IntegrationError);
    expect(new MailError('test')).toBeInstanceOf(IntegrationError);
    expect(new TmuxError('test')).toBeInstanceOf(IntegrationError);

    expect(new PrerequisiteError(['a'])).toBeInstanceOf(SceneError);
    expect(new TakeError('a', 'b')).toBeInstanceOf(SceneError);
  });

  test('all errors extend Error', () => {
    expect(new ConfigurationError('test')).toBeInstanceOf(Error);
    expect(new RuntimeError('test')).toBeInstanceOf(Error);
    expect(new IntegrationError('test')).toBeInstanceOf(Error);
    expect(new SceneError('test')).toBeInstanceOf(Error);
  });
});

// ============================================================================
// toJSON() Serialization Tests
// ============================================================================

describe('toJSON() Serialization', () => {
  test('serializes basic error fields', () => {
    const error = new ConfigurationError('test message');
    const json = error.toJSON();

    expect(json.code).toBe('CONFIGURATION_ERROR');
    expect(json.message).toBe('test message');
  });

  test('serializes context when present', () => {
    const context: ErrorContext = {
      agentName: 'test-agent',
      phase: 'initialization',
    };
    const error = new ConfigurationError('test', context);
    const json = error.toJSON();

    expect(json.context).toBeDefined();
    expect(json.context?.agentName).toBe('test-agent');
    expect(json.context?.phase).toBe('initialization');
  });

  test('omits context when empty', () => {
    const error = new ConfigurationError('test', {});
    const json = error.toJSON();

    expect(json.context).toBeUndefined();
  });

  test('includes stack trace', () => {
    const error = new ConfigurationError('test');
    const json = error.toJSON();

    expect(json.stack).toBeDefined();
    expect(typeof json.stack).toBe('string');
    expect(json.stack).toContain('ConfigurationError');
  });

  test('serializes OrchestrationError cause chain', () => {
    const rootCause = new BeadsError('beads failed');
    const wrapper = new RuntimeError('operation failed', undefined, rootCause);
    const json = wrapper.toJSON();

    expect(json.cause).toBeDefined();
    expect(json.cause?.code).toBe('BEADS_ERROR');
    expect(json.cause?.message).toBe('beads failed');
  });

  test('serializes non-OrchestrationError cause', () => {
    const cause = new TypeError('invalid type');
    const error = new RuntimeError('operation failed', undefined, cause);
    const json = error.toJSON();

    expect(json.cause).toBeDefined();
    expect(json.cause?.code).toBe('UNKNOWN_ERROR');
    expect(json.cause?.message).toBe('invalid type');
    expect(json.cause?.stack).toBeDefined();
  });

  test('serializes deeply nested cause chain', () => {
    const level1 = new BeadsError('level 1');
    const level2 = new RuntimeError('level 2', undefined, level1);
    const level3 = new ConfigurationError('level 3', undefined, level2);
    const json = level3.toJSON();

    expect(json.message).toBe('level 3');
    expect(json.cause?.message).toBe('level 2');
    expect(json.cause?.cause?.message).toBe('level 1');
  });
});

// ============================================================================
// wrapError() Tests
// ============================================================================

describe('wrapError()', () => {
  test('returns OrchestrationError unchanged', () => {
    const original = new ConfigurationError('test');
    const wrapped = wrapError(original);

    expect(wrapped).toBe(original);
  });

  test('enriches OrchestrationError with context if provided', () => {
    const original = new ConfigurationError('test', { existing: 'value' });
    const wrapped = wrapError(original, { added: 'context' });

    expect(wrapped).not.toBe(original); // New instance
    expect(wrapped.context?.existing).toBe('value');
    expect(wrapped.context?.added).toBe('context');
  });

  test('wraps standard Error in RuntimeError', () => {
    const original = new TypeError('type error');
    const wrapped = wrapError(original);

    expect(wrapped).toBeInstanceOf(OrchestrationError);
    expect(wrapped.code).toBe('WRAPPED_ERROR');
    expect(wrapped.message).toBe('type error');
    expect(wrapped.cause).toBe(original);
  });

  test('wraps string in RuntimeError', () => {
    const wrapped = wrapError('something went wrong');

    expect(wrapped).toBeInstanceOf(OrchestrationError);
    expect(wrapped.code).toBe('WRAPPED_ERROR');
    expect(wrapped.message).toBe('something went wrong');
  });

  test('wraps object with JSON.stringify', () => {
    const wrapped = wrapError({ error: true, code: 500 });

    expect(wrapped).toBeInstanceOf(OrchestrationError);
    expect(wrapped.code).toBe('WRAPPED_ERROR');
    expect(wrapped.message).toContain('"error":true');
    expect(wrapped.message).toContain('"code":500');
  });

  test('wraps null', () => {
    const wrapped = wrapError(null);

    expect(wrapped).toBeInstanceOf(OrchestrationError);
    expect(wrapped.message).toContain('null');
  });

  test('wraps undefined', () => {
    const wrapped = wrapError(undefined);

    expect(wrapped).toBeInstanceOf(OrchestrationError);
    expect(wrapped.message).toContain('undefined');
  });

  test('wraps number', () => {
    const wrapped = wrapError(42);

    expect(wrapped).toBeInstanceOf(OrchestrationError);
    expect(wrapped.message).toContain('42');
  });

  test('adds context to wrapped error', () => {
    const original = new Error('test');
    const wrapped = wrapError(original, { operation: 'save' });

    expect(wrapped.context?.operation).toBe('save');
  });
});

// ============================================================================
// enrichError() Tests
// ============================================================================

describe('enrichError()', () => {
  test('adds new context to error', () => {
    const original = new ConfigurationError('test');
    const enriched = enrichError(original, { added: 'value' });

    expect(enriched).not.toBe(original);
    expect(enriched.context?.added).toBe('value');
  });

  test('merges with existing context', () => {
    const original = new ConfigurationError('test', { existing: 'value' });
    const enriched = enrichError(original, { added: 'new' });

    expect(enriched.context?.existing).toBe('value');
    expect(enriched.context?.added).toBe('new');
  });

  test('new context overrides existing keys', () => {
    const original = new ConfigurationError('test', { key: 'old' });
    const enriched = enrichError(original, { key: 'new' });

    expect(enriched.context?.key).toBe('new');
  });

  test('preserves error type', () => {
    const original = new EntityNotFoundError('agent', 'test');
    const enriched = enrichError(original, { added: 'value' });

    expect(enriched).toBeInstanceOf(EntityNotFoundError);
    expect(enriched.entityType).toBe('agent');
    expect(enriched.entityId).toBe('test');
  });

  test('preserves error code', () => {
    const original = new ConfigurationError('original message');
    const enriched = enrichError(original, { added: 'value' });

    expect(enriched.code).toBe('CONFIGURATION_ERROR');
  });

  test('preserves cause', () => {
    const cause = new Error('root cause');
    const original = new ConfigurationError('test', undefined, cause);
    const enriched = enrichError(original, { added: 'value' });

    expect(enriched.cause).toBe(cause);
  });
});

// ============================================================================
// getErrorChain() Tests
// ============================================================================

describe('getErrorChain()', () => {
  test('returns single error when no cause', () => {
    const error = new ConfigurationError('test');
    const chain = getErrorChain(error);

    expect(chain).toHaveLength(1);
    expect(chain[0]).toBe(error);
  });

  test('returns full chain with OrchestrationError causes', () => {
    const level1 = new BeadsError('level 1');
    const level2 = new RuntimeError('level 2', undefined, level1);
    const level3 = new ConfigurationError('level 3', undefined, level2);
    const chain = getErrorChain(level3);

    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe(level3);
    expect(chain[1]).toBe(level2);
    expect(chain[2]).toBe(level1);
  });

  test('returns full chain with standard Error causes', () => {
    const rootCause = new TypeError('type error');
    const error = new RuntimeError('wrapper', undefined, rootCause);
    const chain = getErrorChain(error);

    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe(error);
    expect(chain[1]).toBe(rootCause);
  });

  test('handles circular references', () => {
    // Create a circular reference using Object.assign
    const error1 = new Error('error1');
    const error2 = new Error('error2');
    (error1 as Error & { cause: Error }).cause = error2;
    (error2 as Error & { cause: Error }).cause = error1;

    const chain = getErrorChain(error1);

    // Should stop at circular reference
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe(error1);
    expect(chain[1]).toBe(error2);
  });

  test('works with native Error cause', () => {
    const cause = new Error('root');
    const error = new Error('wrapper', { cause });
    const chain = getErrorChain(error);

    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe(error);
    expect(chain[1]).toBe(cause);
  });
});

// ============================================================================
// isOrchestrationError() Type Guard Tests
// ============================================================================

describe('isOrchestrationError()', () => {
  test('returns true for OrchestrationError instances', () => {
    expect(isOrchestrationError(new ConfigurationError('test'))).toBe(true);
    expect(isOrchestrationError(new RuntimeError('test'))).toBe(true);
    expect(isOrchestrationError(new IntegrationError('test'))).toBe(true);
    expect(isOrchestrationError(new SceneError('test'))).toBe(true);
  });

  test('returns true for derived error types', () => {
    expect(isOrchestrationError(new EntityNotFoundError('a', 'b'))).toBe(true);
    expect(isOrchestrationError(new HookExecutionError('test'))).toBe(true);
    expect(isOrchestrationError(new BeadsError('test'))).toBe(true);
    expect(isOrchestrationError(new PrerequisiteError(['a']))).toBe(true);
  });

  test('returns false for standard Error', () => {
    expect(isOrchestrationError(new Error('test'))).toBe(false);
    expect(isOrchestrationError(new TypeError('test'))).toBe(false);
    expect(isOrchestrationError(new SyntaxError('test'))).toBe(false);
  });

  test('returns false for non-Error values', () => {
    expect(isOrchestrationError(null)).toBe(false);
    expect(isOrchestrationError(undefined)).toBe(false);
    expect(isOrchestrationError('error string')).toBe(false);
    expect(isOrchestrationError({ message: 'error object' })).toBe(false);
    expect(isOrchestrationError(42)).toBe(false);
  });
});

// ============================================================================
// getRootCause() Tests
// ============================================================================

describe('getRootCause()', () => {
  test('returns same error when no cause', () => {
    const error = new ConfigurationError('test');
    const root = getRootCause(error);

    expect(root).toBe(error);
  });

  test('returns deepest cause', () => {
    const level1 = new BeadsError('level 1');
    const level2 = new RuntimeError('level 2', undefined, level1);
    const level3 = new ConfigurationError('level 3', undefined, level2);
    const root = getRootCause(level3);

    expect(root).toBe(level1);
  });

  test('works with standard Error cause', () => {
    const rootCause = new TypeError('type error');
    const error = new RuntimeError('wrapper', undefined, rootCause);
    const root = getRootCause(error);

    expect(root).toBe(rootCause);
  });
});

// ============================================================================
// hasErrorInChain() Tests
// ============================================================================

describe('hasErrorInChain()', () => {
  test('returns true when predicate matches', () => {
    const beadsError = new BeadsError('beads failed');
    const wrapper = new RuntimeError('wrapper', undefined, beadsError);

    const hasBeads = hasErrorInChain(
      wrapper,
      (err) => err instanceof BeadsError
    );

    expect(hasBeads).toBe(true);
  });

  test('returns false when predicate does not match', () => {
    const error = new ConfigurationError('test');

    const hasBeads = hasErrorInChain(
      error,
      (err) => err instanceof BeadsError
    );

    expect(hasBeads).toBe(false);
  });

  test('checks entire chain', () => {
    const level1 = new BeadsError('level 1');
    const level2 = new RuntimeError('level 2', undefined, level1);
    const level3 = new ConfigurationError('level 3', undefined, level2);

    expect(hasErrorInChain(level3, (e) => e instanceof ConfigurationError)).toBe(true);
    expect(hasErrorInChain(level3, (e) => e instanceof RuntimeError)).toBe(true);
    expect(hasErrorInChain(level3, (e) => e instanceof BeadsError)).toBe(true);
  });
});

// ============================================================================
// findErrorInChain() Tests
// ============================================================================

describe('findErrorInChain()', () => {
  test('returns matching error from chain', () => {
    const beadsError = new BeadsError('beads failed');
    const wrapper = new RuntimeError('wrapper', undefined, beadsError);

    const found = findErrorInChain(
      wrapper,
      (err): err is BeadsError => err instanceof BeadsError
    );

    expect(found).toBe(beadsError);
  });

  test('returns undefined when not found', () => {
    const error = new ConfigurationError('test');

    const found = findErrorInChain(
      error,
      (err): err is BeadsError => err instanceof BeadsError
    );

    expect(found).toBeUndefined();
  });

  test('returns first match in chain', () => {
    const beads1 = new BeadsError('beads 1');
    const beads2 = new BeadsError('beads 2', undefined, beads1);
    const wrapper = new RuntimeError('wrapper', undefined, beads2);

    const found = findErrorInChain(
      wrapper,
      (err): err is BeadsError => err instanceof BeadsError
    );

    expect(found).toBe(beads2);
  });
});

// ============================================================================
// formatStack() Tests
// ============================================================================

describe('formatStack()', () => {
  test('formats error with stack trace', () => {
    // Create error with explicit stack for consistent testing
    const error = new Error('test error');
    error.stack = `Error: test error
    at testFunction (/app/test.js:10:5)
    at Object.<anonymous> (/app/main.js:1:1)`;

    const formatted = formatStack(error);

    expect(formatted).toContain('Error: test error');
    expect(formatted).toContain('testFunction');
  });

  test('handles error without stack trace', () => {
    const error = new Error('test error');
    error.stack = undefined;
    const formatted = formatStack(error);

    expect(formatted).toContain('Error: test error');
    expect(formatted).toContain('no stack trace available');
  });

  test('filters node internals by default', () => {
    const error = new Error('test');
    // Note: <anonymous> is also filtered, so use a named function
    error.stack = `Error: test
    at testFunction (/app/test.js:1:1)
    at node:internal/modules/cjs/loader:1293:14
    at node:internal/modules/run_main:57:12`;

    const formatted = formatStack(error);

    expect(formatted).toContain('/app/test.js:1:1');
    expect(formatted).not.toContain('node:internal');
  });

  test('includes internals when requested', () => {
    const error = new Error('test');
    error.stack = `Error: test
    at Object.<anonymous> (/app/test.js:1:1)
    at node:internal/modules/cjs/loader:1293:14`;

    const formatted = formatStack(error, { includeInternals: true });

    expect(formatted).toContain('node:internal');
  });

  test('limits frame count', () => {
    const error = new Error('test');
    const frames = Array.from({ length: 30 }, (_, i) => `    at frame${i} (/app/test.js:${i}:1)`);
    error.stack = `Error: test\n${frames.join('\n')}`;

    const formatted = formatStack(error, { maxFrames: 5 });

    expect(formatted).toContain('frame0');
    expect(formatted).toContain('more frames');
  });
});

// ============================================================================
// Error Construction with Context and Cause
// ============================================================================

describe('Error Construction', () => {
  test('errors preserve context', () => {
    const context: ErrorContext = {
      agentName: 'test-agent',
      hookName: 'pre-run',
      sceneId: 'scene-1',
      phase: 'execution',
    };
    const error = new RuntimeError('test', context);

    expect(error.context).toEqual(context);
  });

  test('errors preserve cause chain', () => {
    const root = new Error('root cause');
    const middle = new BeadsError('middle', undefined, root);
    const top = new RuntimeError('top', undefined, middle);

    expect(top.cause).toBe(middle);
    expect(middle.cause).toBe(root);
  });

  test('error name matches class name', () => {
    expect(new ConfigurationError('test').name).toBe('ConfigurationError');
    expect(new EntityNotFoundError('a', 'b').name).toBe('EntityNotFoundError');
    expect(new HookExecutionError('test').name).toBe('HookExecutionError');
    expect(new BeadsError('test').name).toBe('BeadsError');
  });
});
