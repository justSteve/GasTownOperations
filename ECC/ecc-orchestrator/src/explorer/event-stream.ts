/**
 * Event Stream - SSE/WebSocket server for streaming execution events
 *
 * Provides real-time event streaming from scene execution to UI clients.
 * Supports both Server-Sent Events (SSE) and console output.
 */

import { EventEmitter } from 'node:events';
import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { watchFile, unwatchFile, existsSync, readFileSync } from 'node:fs';
import type { EngineEventType, EventDataMap } from '../events/event-types.js';
import type { EngineEventEmitter } from '../events/event-emitter.js';

// ============================================================================
// Event Stream Types
// ============================================================================

/**
 * Stream event wrapper with ID for SSE.
 */
export interface StreamEvent {
  id: string;
  type: EngineEventType;
  timestamp: string;
  data: unknown;
}

/**
 * Connected client for SSE.
 */
interface SSEClient {
  id: string;
  response: ServerResponse;
  connectedAt: string;
}

// ============================================================================
// Event Stream Server
// ============================================================================

/**
 * Options for event stream server.
 */
export interface EventStreamOptions {
  /** Port to listen on (default: 3001) */
  port?: number;
  /** Host to bind to (default: localhost) */
  host?: string;
  /** Engine event emitter to subscribe to */
  eventEmitter?: EngineEventEmitter;
  /** Path to event log file to watch */
  eventLogPath?: string;
}

/**
 * Event stream server for SSE and console output.
 */
export class EventStreamServer extends EventEmitter {
  private options: Required<Omit<EventStreamOptions, 'eventEmitter' | 'eventLogPath'>> & {
    eventEmitter: EngineEventEmitter | null;
    eventLogPath: string | null;
  };
  private server: Server | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private eventCounter = 0;
  private lastLogPosition = 0;

  constructor(options: EventStreamOptions = {}) {
    super();
    this.options = {
      port: options.port || 3001,
      host: options.host || 'localhost',
      eventEmitter: options.eventEmitter || null,
      eventLogPath: options.eventLogPath || null,
    };
  }

  /**
   * Start the SSE server.
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        this.emit('started', { port: this.options.port, host: this.options.host });
        this.subscribeToEvents();
        resolve();
      });
    });
  }

  /**
   * Stop the SSE server.
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all client connections
      for (const client of this.clients.values()) {
        client.response.end();
      }
      this.clients.clear();

      // Unwatch log file
      if (this.options.eventLogPath) {
        unwatchFile(this.options.eventLogPath);
      }

      // Close server
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.emit('stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Broadcast an event to all connected clients.
   */
  broadcast(type: EngineEventType, data: unknown): void {
    const event: StreamEvent = {
      id: String(++this.eventCounter),
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    const sseData = this.formatSSE(event);

    for (const client of this.clients.values()) {
      client.response.write(sseData);
    }

    // Also emit locally for console output
    this.emit('event', event);
  }

  /**
   * Get connected client count.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    switch (url.pathname) {
      case '/events':
        this.handleSSEConnection(req, res);
        break;
      case '/health':
        this.handleHealthCheck(res);
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  private handleSSEConnection(req: IncomingMessage, res: ServerResponse): void {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

    // Register client
    const client: SSEClient = {
      id: clientId,
      response: res,
      connectedAt: new Date().toISOString(),
    };
    this.clients.set(clientId, client);

    this.emit('clientConnected', { clientId });

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      this.emit('clientDisconnected', { clientId });
    });

    // Keep-alive ping every 30 seconds
    const keepAlive = setInterval(() => {
      if (this.clients.has(clientId)) {
        res.write(': ping\n\n');
      } else {
        clearInterval(keepAlive);
      }
    }, 30000);
  }

  private handleHealthCheck(res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        clients: this.clients.size,
        uptime: process.uptime(),
      })
    );
  }

  private formatSSE(event: StreamEvent): string {
    return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  private subscribeToEvents(): void {
    // Subscribe to engine events if emitter provided
    if (this.options.eventEmitter) {
      const eventTypes: EngineEventType[] = [
        'scene:start',
        'scene:step',
        'scene:complete',
        'scene:error',
        'tool:call',
        'tool:result',
        'tool:blocked',
        'hook:before',
        'hook:after',
        'hook:error',
        'log:entry',
      ];

      for (const type of eventTypes) {
        this.options.eventEmitter.on(type, (data: EventDataMap[typeof type]) => {
          this.broadcast(type, data);
        });
      }
    }

    // Watch event log file if path provided
    if (this.options.eventLogPath) {
      this.watchEventLog(this.options.eventLogPath);
    }
  }

  private watchEventLog(path: string): void {
    // Initial read
    this.readNewLogEntries(path);

    // Watch for changes
    watchFile(path, { interval: 100 }, () => {
      this.readNewLogEntries(path);
    });
  }

  private readNewLogEntries(path: string): void {
    if (!existsSync(path)) return;

    try {
      const content = readFileSync(path, 'utf-8');
      const newContent = content.slice(this.lastLogPosition);
      this.lastLogPosition = content.length;

      if (newContent.trim()) {
        const lines = newContent.trim().split('\n');
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type) {
              this.broadcast(event.type, event.data || event);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch {
      // File read error - ignore
    }
  }
}

/**
 * Create a new event stream server.
 */
export function createEventStream(options?: EventStreamOptions): EventStreamServer {
  return new EventStreamServer(options);
}

// ============================================================================
// Console Event Logger
// ============================================================================

/**
 * Simple console logger for events (no HTTP server).
 */
export class ConsoleEventLogger extends EventEmitter {
  private eventEmitter: EngineEventEmitter | null;
  private colors: Record<string, string> = {
    'scene:start': '\x1b[32m',    // Green
    'scene:step': '\x1b[36m',     // Cyan
    'scene:complete': '\x1b[32m', // Green
    'scene:error': '\x1b[31m',    // Red
    'tool:call': '\x1b[33m',      // Yellow
    'tool:result': '\x1b[33m',    // Yellow
    'tool:blocked': '\x1b[31m',   // Red
    'hook:before': '\x1b[35m',    // Magenta
    'hook:after': '\x1b[35m',     // Magenta
    'hook:error': '\x1b[31m',     // Red
    reset: '\x1b[0m',
  };

  constructor(eventEmitter?: EngineEventEmitter) {
    super();
    this.eventEmitter = eventEmitter || null;
  }

  /**
   * Start logging events to console.
   */
  start(): void {
    if (!this.eventEmitter) return;

    const types: EngineEventType[] = [
      'scene:start',
      'scene:step',
      'scene:complete',
      'scene:error',
      'tool:call',
      'tool:result',
      'hook:after',
    ];

    for (const type of types) {
      this.eventEmitter.on(type, (data: unknown) => {
        this.logEvent(type, data);
      });
    }
  }

  private logEvent(type: EngineEventType, data: unknown): void {
    const color = this.colors[type] || '';
    const reset = this.colors.reset || '\x1b[0m';
    const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 12) || '';

    console.log(`${color}[${timestamp}] ${type}${reset}`, JSON.stringify(data, null, 2));
  }
}

/**
 * Create a console event logger.
 */
export function createConsoleLogger(eventEmitter?: EngineEventEmitter): ConsoleEventLogger {
  return new ConsoleEventLogger(eventEmitter);
}
