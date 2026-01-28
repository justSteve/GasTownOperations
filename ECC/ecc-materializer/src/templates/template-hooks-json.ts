/**
 * Hooks JSON Template Generator
 *
 * Generates .claude/hooks/hooks.json file from EccHook entities.
 * This is an AGGREGATED template - all hooks combine into one file.
 */

import type { EccHook, EccHookAction } from '../ecc-types.js';

/**
 * Output structure for hooks.json
 */
interface HooksJsonOutput {
  hooks: HookEntry[];
}

interface HookEntry {
  name: string;
  event: string;
  matcher?: string;
  enabled: boolean;
  priority?: number;
  actions: HookActionEntry[];
}

interface HookActionEntry {
  type: string;
  command?: string;
  args?: Record<string, unknown>;
}

/**
 * Generate the hooks.json content from all hooks
 */
export function generateHooksJson(hooks: EccHook[]): string {
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

      if (hook.matcher) {
        entry.matcher = hook.matcher;
      }
      if (hook.priority !== undefined && hook.priority !== 0) {
        entry.priority = hook.priority;
      }

      return entry;
    }),
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Get the output file path for hooks
 */
export function getHooksFilePath(): string {
  return 'hooks/hooks.json';
}
