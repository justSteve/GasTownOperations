/**
 * Hooks JSON Template Generator
 *
 * Generates .claude/hooks/hooks.json file from EccHook entities.
 * This is an AGGREGATED template - all hooks combine into one file.
 *
 * Claude Code 2.1 Extensions:
 * - New event types: UserPromptSubmit, Stop
 * - Structured matchers from HookMatchers table
 * - Scope hierarchy support
 */

import type { EccHook, EccHookAction, EccHookMatcher, EccHookScope } from '../ecc-types.js';

/**
 * Valid event types for Claude Code hooks
 * Extended in 2.1 with UserPromptSubmit and Stop
 */
export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'  // Claude Code 2.1: fires before user prompt is processed
  | 'Stop'              // Claude Code 2.1: fires when agent stops
  | 'Notification'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompact';

/**
 * Output structure for hooks.json
 */
interface HooksJsonOutput {
  hooks: HookEntry[];
  scopes?: HookScopeEntry[];  // Claude Code 2.1: optional scope hierarchy
}

interface HookEntry {
  name: string;
  event: string;
  matcher?: string;
  matchers?: HookMatcherEntry[];  // Claude Code 2.1: structured matchers
  enabled: boolean;
  priority?: number;
  scope?: string;  // Claude Code 2.1: scope reference
  actions: HookActionEntry[];
}

interface HookMatcherEntry {
  type: 'tool' | 'skill' | 'pattern';
  pattern: string;
  description?: string;
}

interface HookScopeEntry {
  name: string;
  level: 'Global' | 'Project' | 'Skill' | 'SubAgent';
  priority?: number;
  description?: string;
}

interface HookActionEntry {
  type: string;
  command?: string;
  args?: Record<string, unknown>;
}

/**
 * Generate the hooks.json content from all hooks
 *
 * @param hooks - Array of EccHook entities
 * @param scopes - Optional array of EccHookScope entities for scope hierarchy
 * @param scopeMap - Optional map of scope IDs to scope names for resolution
 */
export function generateHooksJson(
  hooks: EccHook[],
  scopes?: EccHookScope[],
  scopeMap?: Map<string, string>
): string {
  const output: HooksJsonOutput = {
    hooks: hooks.map((hook) => {
      const entry: HookEntry = {
        name: hook.name,
        event: hook.eventType,
        enabled: hook.enabled ?? true,
        actions: (hook.actions ?? [])
          .sort((a, b) => (a.actionOrder ?? 0) - (b.actionOrder ?? 0))
          .map((action) => {
            const actionEntry: HookActionEntry = {
              type: action.actionType,
            };
            if (action.command) {
              actionEntry.command = action.command;
            }
            if (action.arguments) {
              actionEntry.args = action.arguments;
            }
            return actionEntry;
          }),
      };

      // Legacy matcher support (simple string pattern)
      if (hook.matcher) {
        entry.matcher = hook.matcher;
      }

      // Claude Code 2.1: Structured matchers from HookMatchers table
      if (hook.matchers && hook.matchers.length > 0) {
        entry.matchers = hook.matchers.map((m) => {
          const matcherEntry: HookMatcherEntry = {
            type: m.matcherType,
            pattern: m.pattern,
          };
          if (m.description) {
            matcherEntry.description = m.description;
          }
          return matcherEntry;
        });
      }

      if (hook.priority !== undefined && hook.priority !== 0) {
        entry.priority = hook.priority;
      }

      // Claude Code 2.1: Scope reference
      if (hook.scopeId && scopeMap) {
        const scopeName = scopeMap.get(hook.scopeId);
        if (scopeName) {
          entry.scope = scopeName;
        }
      }

      return entry;
    }),
  };

  // Claude Code 2.1: Include scopes if provided
  if (scopes && scopes.length > 0) {
    output.scopes = scopes
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((scope) => {
        const scopeEntry: HookScopeEntry = {
          name: scope.name,
          level: scope.level,
        };
        if (scope.priority !== undefined && scope.priority !== 0) {
          scopeEntry.priority = scope.priority;
        }
        if (scope.description) {
          scopeEntry.description = scope.description;
        }
        return scopeEntry;
      });
  }

  return JSON.stringify(output, null, 2);
}

/**
 * Build a scope ID to name map for resolving hook scope references
 */
export function buildScopeMap(scopes: EccHookScope[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const scope of scopes) {
    map.set(scope.id, scope.name);
  }
  return map;
}

/**
 * Validate that an event type is a valid Claude Code hook event
 */
export function isValidHookEventType(eventType: string): eventType is HookEventType {
  const validEvents: HookEventType[] = [
    'PreToolUse',
    'PostToolUse',
    'UserPromptSubmit',
    'Stop',
    'Notification',
    'SessionStart',
    'SessionEnd',
    'PreCompact',
  ];
  return validEvents.includes(eventType as HookEventType);
}

/**
 * Get the output file path for hooks
 */
export function getHooksFilePath(): string {
  return 'hooks/hooks.json';
}
