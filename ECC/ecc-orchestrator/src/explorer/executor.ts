/**
 * Executor - Run Claude Code CLI with generated configuration
 *
 * Manages scene execution, handles CLI invocation, captures output,
 * and coordinates with the event stream.
 */

import { spawn, ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import type {
  SceneTemplate,
  ExecutionContext,
  ExecutionResult,
  ExecutionState,
  ResolvedParameters,
  GeneratedConfig,
} from './types.js';
import type { EngineEventEmitter } from '../events/event-emitter.js';
import { ExecutionError, TimeoutError } from '../errors/error-types.js';

// ============================================================================
// Executor
// ============================================================================

/**
 * Options for scene execution.
 */
export interface ExecutorOptions {
  /** Path to Claude Code CLI (default: 'claude') */
  claudeCliPath?: string;
  /** Execution timeout in milliseconds (default: 300000 = 5 min) */
  timeoutMs?: number;
  /** Event emitter for streaming events */
  eventEmitter?: EngineEventEmitter;
  /** Working directory for Claude Code */
  workingDir?: string;
  /**
   * Skip Claude Code permission prompts (DEVELOPMENT/TESTING ONLY).
   *
   * When true, passes --dangerously-skip-permissions to the CLI.
   * This should NEVER be enabled in production environments.
   *
   * Default: false
   */
  dangerouslySkipPermissions?: boolean;
}

/**
 * Scene executor manages Claude Code CLI execution.
 */
export class SceneExecutor extends EventEmitter {
  private options: Required<ExecutorOptions>;
  private currentProcess: ChildProcess | null = null;
  private currentContext: ExecutionContext | null = null;

  constructor(options: ExecutorOptions = {}) {
    super();
    this.options = {
      claudeCliPath: options.claudeCliPath || 'claude',
      timeoutMs: options.timeoutMs || 300000,
      eventEmitter: options.eventEmitter || null!,
      workingDir: options.workingDir || process.cwd(),
      dangerouslySkipPermissions: options.dangerouslySkipPermissions || false,
    };
  }

  /**
   * Execute a scene with the given configuration.
   */
  async execute(
    scene: SceneTemplate,
    config: GeneratedConfig,
    parameters: ResolvedParameters
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const eventLogPath = `${config.configDir}/events.jsonl`;

    // Initialize execution context
    this.currentContext = {
      sceneId: scene.scene.id,
      actId: String(scene.scene.act),
      state: 'configuring',
      currentStep: 0,
      parameters,
      startedAt: new Date().toISOString(),
      configDir: config.configDir,
      eventLogPath,
    };

    this.emitStateChange('running');

    // Emit scene start event
    if (this.options.eventEmitter) {
      this.options.eventEmitter.emit('scene:start', {
        sceneId: scene.scene.id,
        actId: String(scene.scene.act),
        parameters: parameters as Record<string, unknown>,
      });
    }

    try {
      // Execute each step in the scene
      for (let i = 0; i < scene.executionSteps.length; i++) {
        const step = scene.executionSteps[i];
        if (!step) continue;

        this.currentContext.currentStep = step.step;

        // Emit step event
        if (this.options.eventEmitter) {
          const stepEvent: {
            sceneId: string;
            step: number;
            action: string;
            commentary?: string;
          } = {
            sceneId: scene.scene.id,
            step: step.step,
            action: step.action,
          };
          if (step.commentary?.l1) {
            stepEvent.commentary = step.commentary.l1;
          }
          this.options.eventEmitter.emit('scene:step', stepEvent);
        }

        // Execute the step
        await this.executeStep(step, config);
      }

      const durationMs = Date.now() - startTime;
      this.emitStateChange('completed');

      // Emit completion event
      if (this.options.eventEmitter) {
        this.options.eventEmitter.emit('scene:complete', {
          sceneId: scene.scene.id,
          durationMs,
          stepsCompleted: scene.executionSteps.length,
        });
      }

      // Collect events from log
      const events = this.readEventLog(eventLogPath);

      return {
        sceneId: scene.scene.id,
        success: true,
        stepsCompleted: scene.executionSteps.length,
        totalSteps: scene.executionSteps.length,
        durationMs,
        events,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.emitStateChange('error');

      const errorInfo = {
        step: this.currentContext?.currentStep || 0,
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof ExecutionError ? error.code : 'EXECUTION_ERROR',
      };

      // Emit error event
      if (this.options.eventEmitter) {
        this.options.eventEmitter.emit('scene:error', {
          sceneId: scene.scene.id,
          step: errorInfo.step,
          error: {
            code: errorInfo.code,
            message: errorInfo.message,
          },
        });
      }

      return {
        sceneId: scene.scene.id,
        success: false,
        stepsCompleted: this.currentContext?.currentStep || 0,
        totalSteps: scene.executionSteps.length,
        durationMs,
        events: this.readEventLog(eventLogPath),
        error: errorInfo,
      };
    } finally {
      this.currentContext = null;
    }
  }

  /**
   * Cancel the current execution.
   */
  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
    this.emitStateChange('error');
  }

  /**
   * Get current execution state.
   */
  getState(): ExecutionState {
    return this.currentContext?.state || 'pending';
  }

  /**
   * Get current execution context.
   */
  getContext(): ExecutionContext | null {
    return this.currentContext;
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  private async executeStep(
    step: { step: number; action: string; input?: string },
    config: GeneratedConfig
  ): Promise<void> {
    const { action, input } = step;

    switch (action) {
      case 'display_configuration':
        // No-op for display actions - UI handles these
        break;

      case 'trigger_claude_command':
      case 'execute_command':
        if (input) {
          await this.runClaudeCommand(input, config);
        }
        break;

      case 'invoke_skill':
        if (input) {
          await this.runClaudeCommand(`/${input}`, config);
        }
        break;

      case 'wait':
        // Parse wait duration from input (e.g., "2s", "500ms")
        const waitMs = this.parseWaitDuration(input || '1s');
        await this.delay(waitMs);
        break;

      default:
        // Unknown action - emit warning but continue
        this.emit('warning', { step: step.step, message: `Unknown action: ${action}` });
    }
  }

  private async runClaudeCommand(command: string, config: GeneratedConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.currentProcess) {
          this.currentProcess.kill('SIGTERM');
        }
        reject(new TimeoutError(`Command timed out after ${this.options.timeoutMs}ms`, this.options.timeoutMs));
      }, this.options.timeoutMs);

      // Use inherited env (don't override CLAUDE_CONFIG_DIR - that would lose auth)
      // We use --settings flag to load our hooks instead
      const env = { ...process.env };

      // Build CLI arguments
      // --dangerously-skip-permissions is opt-in and should only be used for testing
      const args = [
        '--print',
        ...(this.options.dangerouslySkipPermissions ? ['--dangerously-skip-permissions'] : []),
        '--settings', config.settingsPath,
      ];

      this.currentProcess = spawn(
        this.options.claudeCliPath,
        args,
        {
          cwd: this.options.workingDir,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      // Send prompt via stdin (required for --print mode)
      if (this.currentProcess.stdin) {
        this.currentProcess.stdin.write(command);
        this.currentProcess.stdin.end();
      }

      let stdout = '';
      let stderr = '';

      this.currentProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.emit('output', { type: 'stdout', data: data.toString() });
      });

      this.currentProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
        this.emit('output', { type: 'stderr', data: data.toString() });
      });

      this.currentProcess.on('close', (code) => {
        clearTimeout(timeout);
        this.currentProcess = null;

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new ExecutionError(
              `Claude command failed with code ${code}: ${stderr}`,
              'COMMAND_FAILED'
            )
          );
        }
      });

      this.currentProcess.on('error', (err) => {
        clearTimeout(timeout);
        this.currentProcess = null;
        reject(new ExecutionError(`Failed to spawn Claude CLI: ${err.message}`, 'SPAWN_ERROR'));
      });
    });
  }

  private readEventLog(path: string): unknown[] {
    if (!existsSync(path)) {
      return [];
    }

    try {
      const content = readFileSync(path, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        });
    } catch {
      return [];
    }
  }

  private parseWaitDuration(input: string): number {
    const match = input.match(/^(\d+)(ms|s)?$/);
    if (!match || !match[1]) return 1000;

    const value = parseInt(match[1], 10);
    const unit = match[2] ?? 's';

    return unit === 'ms' ? value : value * 1000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitStateChange(state: ExecutionState): void {
    if (this.currentContext) {
      this.currentContext.state = state;
    }
    this.emit('stateChange', state);
  }
}

/**
 * Create a new scene executor.
 */
export function createExecutor(options?: ExecutorOptions): SceneExecutor {
  return new SceneExecutor(options);
}
