# Inter-Zgent Communication Design

**Status:** Design document -- ready for review
**Date:** 2026-02-12
**Audience:** Technical architects making implementation decisions for the Gas Town Zgent ecosystem

---

## 1. Introduction

### tmuxMOO Vision

tmuxMOO treats tmux as a **programmable stage** for AI agents. Each Zgent inhabits a tmux pane -- its "room" -- where it runs, produces output, and responds to input. Humans and agents co-habit these sessions, with multiple panes visible simultaneously. The metaphor comes from 1990s MOO (MUD Object-Oriented) systems: persistent rooms, programmable objects with verbs, multi-user presence. tmux is the modern transport that MOO's telnet never could be.

The Session Topology Design (`topology/SESSION-TOPOLOGY.md`) established that agents run in headless background sessions while humans attach to personal view sessions. This document addresses the next question: **how do agents in those sessions talk to each other?**

### The Communication Challenge

tmux is a terminal multiplexer, not a message bus. It multiplexes PTYs and renders text. It has no concept of message routing, delivery guarantees, or structured data exchange. Yet Zgents need all of these:

- **DReader** collects Discord messages and needs to share market signals with other agents
- **ParseClipmate** needs to query DReader for historical data
- **A monitoring agent** needs to react when another agent enters an error state
- **The human operator** needs to see all of this flowing through adjacent panes

Bolting a full message broker onto tmux would violate the design philosophy. Instead, we layer capabilities from simple and reliable up to fast and complex, using each layer where it fits.

### Design Philosophy

1. **Start with files.** Files are inspectable, persistent, and already part of the Gas Town logging conventions.
2. **Use tmux for what tmux does well.** Pane observation, send-keys, hooks -- these are native capabilities that cost nothing to add.
3. **Graduate to IPC only when latency demands it.** Named pipes and Unix sockets are powerful but add process management complexity.
4. **Convention over infrastructure.** If you know a Zgent's name, you know where its logs are, where its inbox is, what session it runs in. No service discovery daemon needed.

---

## 2. Communication Channels

Six channels, ordered from simplest to most capable.

### 2.1 Pane Observation

| Property | Value |
|----------|-------|
| **Mechanism** | `tmux capture-pane -t {target} -p` |
| **Latency** | ~100ms (shell invocation overhead) |
| **Reliability** | Medium -- only captures what is currently displayed |
| **Direction** | Read-only |
| **Use case** | Agent reads another agent's visible terminal output |

**How it works:** Any process with access to the tmux server can read the visible contents of any pane. This is the simplest form of inter-agent awareness -- one agent literally "looks at" what another agent is displaying.

```bash
# Agent A reads DReader's current pane output
tmux capture-pane -t dreader:main.0 -p -S -50

# Capture with timestamps for freshness checking
tmux capture-pane -t dreader:main.0 -p | head -20
```

**Limitations:**
- Returns raw terminal text, not structured data
- Only the visible scrollback buffer (not full history)
- Fragile to display format changes -- if DReader changes its output layout, observers break
- No delivery guarantee -- if text scrolled off screen before capture, it is lost

### 2.2 Narrative Logs (JSONL Files)

| Property | Value |
|----------|-------|
| **Mechanism** | JSONL file tailing via `tail -f` or `inotifywait` |
| **Latency** | ~50ms (filesystem notification to reader) |
| **Reliability** | High -- append-only, survives restarts |
| **Direction** | Write-once, read-many |
| **Use case** | Structured message passing, event streaming, audit trail |

**How it works:** Each Zgent writes structured log entries to its own JSONL file. Other Zgents or human-facing panes tail the file for updates. This is already the convention in the Gas Town ecosystem via the `ZgentTransport` class in the AOE.

```bash
# DReader writes to its narrative log
echo '{"ts":"2026-02-12T10:00:00Z","from":"dreader","type":"narrative","content":"SPX volume spike at 5835","tags":["spx","volume"]}' \
  >> /var/log/moo/dreader-narrative.jsonl

# Another agent subscribes
tail -f /var/log/moo/dreader-narrative.jsonl | while read -r line; do
    echo "$line" | jq -r 'select(.tags | index("spx")) | .content'
done
```

**Existing infrastructure:** The `ZgentTransport` (`ECC/ecc-orchestrator/src/logging/transports/zgent.ts`) already writes JSONL to `~/.zgents/logs/{zgentId}/` with a per-Zgent registry at `~/.zgents/registry.json`. This document proposes extending that convention with a dedicated narrative channel at `/var/log/moo/`.

**Limitations:**
- Polling overhead if using `tail -f` (though `inotifywait` reduces this)
- No guaranteed delivery order across multiple writers to the same file
- Files grow without bound unless rotated (ZgentTransport handles this)
- Not bidirectional -- you can read a log, but the writer does not know you read it

### 2.3 tmux Hooks

| Property | Value |
|----------|-------|
| **Mechanism** | `tmux set-hook` with `run-shell` actions |
| **Latency** | Immediate (fires synchronously with the triggering event) |
| **Reliability** | Medium -- hooks can silently fail if the shell command errors |
| **Direction** | Event-driven, one-way |
| **Use case** | React to session events: pane focus, window creation, client attach/detach |

**How it works:** tmux fires hooks on session lifecycle events. A hook can trigger a shell command that logs the event, notifies an agent, or modifies the environment.

```bash
# Log whenever someone focuses on DReader's pane
tmux set-hook -t dreader after-select-pane \
  'run-shell "echo {\"ts\":\"$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ)\",\"event\":\"pane-focused\",\"session\":\"dreader\"} >> /var/log/moo/dreader-events.jsonl"'

# React to new window creation in the ops session
tmux set-hook -t moo-ops after-new-window \
  'run-shell "/usr/local/bin/moo-window-created #{window_id} #{window_name}"'

# Notify on client detach (human left)
tmux set-hook -g client-detached \
  'run-shell "echo {\"ts\":\"$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ)\",\"event\":\"client-detached\",\"client\":\"#{client_name}\"} >> /var/log/moo/presence.jsonl"'
```

**Available hook events relevant to inter-Zgent communication:**

| Hook | Fires when |
|------|-----------|
| `after-select-pane` | A pane gains focus |
| `after-new-window` | A new window is created |
| `after-new-session` | A new session starts |
| `client-attached` | A human attaches to a session |
| `client-detached` | A human detaches |
| `pane-died` | A pane's process exits |
| `alert-activity` | Activity detected in a monitored window |

**Limitations:**
- Hook actions are fire-and-forget shell commands -- no return value
- Complex shell commands in hooks are fragile (quoting, escaping)
- Hooks are per-session or global, not per-Zgent without wrapping logic
- No built-in filtering or routing

### 2.4 tmux send-keys (Command Injection)

| Property | Value |
|----------|-------|
| **Mechanism** | `tmux send-keys -t {target} '{command}' Enter` |
| **Latency** | ~100ms (shell invocation + target processing) |
| **Reliability** | Low -- depends on target's input state |
| **Direction** | Write-only (push to target) |
| **Use case** | One agent triggers a command in another agent's pane |

**How it works:** Any process with tmux server access can inject keystrokes into any pane. This is the tmux equivalent of "speaking to someone in their room."

```bash
# Ask DReader to run a query
tmux send-keys -t dreader:main.0 '/query volume SPX 2026-02-12' Enter

# Send Ctrl-C to cancel a hung command
tmux send-keys -t dreader:main.0 C-c
```

**Limitations:**
- No way to know if the target processed the input
- If the target pane is in the wrong state (e.g., a vim session), injected keys cause havoc
- No response channel -- you inject a command but cannot read the result through this mechanism alone
- Race conditions if multiple agents send-keys to the same pane concurrently

### 2.5 Named Pipes (FIFO)

| Property | Value |
|----------|-------|
| **Mechanism** | FIFO per Zgent at `/var/moo/{zgent}-inbox` |
| **Latency** | <10ms (kernel IPC, no filesystem overhead) |
| **Reliability** | Medium -- writer blocks if no reader; reader blocks if no writer |
| **Direction** | Unidirectional per pipe (create two for bidirectional) |
| **Use case** | Direct request/response between specific agent pairs |

**How it works:** Each Zgent creates a named pipe as its "inbox." Other Zgents write requests to the pipe; the owning Zgent reads and processes them.

```bash
# DReader creates its inbox at startup
mkfifo /var/moo/dreader-inbox
chmod 660 /var/moo/dreader-inbox

# DReader listens for queries
while true; do
    if read -r msg < /var/moo/dreader-inbox; then
        response=$(handle_query "$msg")
        # Write response to requester's inbox
        requester=$(echo "$msg" | jq -r '.replyTo')
        echo "$response" > "/var/moo/${requester}-inbox"
    fi
done

# ParseClipmate sends a query
echo '{"id":"q-123","method":"query","params":{"type":"volume","symbol":"SPX"},"replyTo":"parseclipmate"}' \
  > /var/moo/dreader-inbox
```

**Limitations:**
- Blocking semantics: a write blocks if no reader is attached (use `O_NONBLOCK` to mitigate)
- One reader at a time -- cannot have multiple agents reading the same inbox
- No message framing -- if two writers write concurrently, messages can interleave
- Pipe disappears if filesystem is ephemeral (tmpfs)
- Requires careful lifecycle management: create on startup, clean up on shutdown

### 2.6 Unix Domain Sockets

| Property | Value |
|----------|-------|
| **Mechanism** | Per-Zgent socket at `/var/moo/{zgent}.sock` |
| **Latency** | <5ms (kernel IPC with connection management) |
| **Reliability** | High -- connection-oriented, supports concurrent clients |
| **Direction** | Bidirectional |
| **Use case** | Structured query/response, streaming data, multiple concurrent clients |

**How it works:** Each Zgent runs a Unix domain socket server. Other Zgents connect as clients, send structured requests, and receive responses on the same connection.

```bash
# DReader runs a socket server using socat
socat UNIX-LISTEN:/var/moo/dreader.sock,fork EXEC:/usr/local/bin/dreader-handler

# Or with a custom handler in Node.js
# (see code example in Section 3, Layer 2)

# ParseClipmate queries via the socket
echo '{"id":"q-123","method":"query","params":{"type":"volume","symbol":"SPX"}}' \
  | socat - UNIX-CONNECT:/var/moo/dreader.sock
```

**Limitations:**
- Requires a listening process -- if the Zgent crashes, the socket becomes stale
- More complex setup than files or pipes
- Needs explicit protocol definition (message framing, request/response correlation)
- Socket files must be cleaned up on abnormal termination

---

## 3. Layered Architecture

Rather than choosing one channel, the system uses a layered approach. Each layer adds capability at the cost of complexity. A Zgent starts at Layer 0 and only adopts higher layers when it needs their properties.

```
+----------------------------------------------------------+
|  Layer 2: Direct IPC                                      |
|  Named pipes / Unix sockets                              |
|  For: latency-sensitive query/response                   |
+----------------------------------------------------------+
|  Layer 1: tmux-native                                     |
|  capture-pane / send-keys / hooks                        |
|  For: real-time co-presence awareness                    |
+----------------------------------------------------------+
|  Layer 0: File-based                                      |
|  JSONL narrative logs                                     |
|  For: everything else (default)                          |
+----------------------------------------------------------+
```

### Layer 0: File-based (JSONL Narrative Logs)

**Status:** Already partially implemented via `ZgentTransport` in the AOE.

Each Zgent writes to a narrative log. The log is the Zgent's public voice -- anything it wants other Zgents or humans to see goes here.

**Convention:**

| Path | Purpose |
|------|---------|
| `/var/log/moo/{zgent}-narrative.jsonl` | Public narrative stream |
| `~/.zgents/logs/{zgent}/{timestamp}.jsonl` | Full operational log (existing AOE convention) |

The narrative log is a curated subset of the operational log. The operational log contains debug output, internal state changes, error details. The narrative log contains only what is meant for external consumption.

**Message format:**

```json
{"ts": "2026-02-12T10:00:00Z", "from": "dreader", "type": "narrative", "content": "SPX volume spike detected at 5835", "tags": ["spx", "volume"]}
```

```json
{"ts": "2026-02-12T10:00:01Z", "from": "dreader", "type": "query-response", "queryId": "q-123", "content": {"symbol": "SPX", "volume": 125000}}
```

```json
{"ts": "2026-02-12T10:00:05Z", "from": "dreader", "type": "status", "content": "healthy", "uptime": 3600}
```

**Mandatory fields:**

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO 8601 string | When the message was produced |
| `from` | string | Zgent identifier (matches registry) |
| `type` | string | Message type (see below) |
| `content` | string or object | The payload |

**Message types:**

| Type | Meaning |
|------|---------|
| `narrative` | Free-form observation or event description |
| `query-response` | Response to a query, includes `queryId` |
| `status` | Health/state update |
| `alert` | Urgent notification requiring attention |
| `error` | Something went wrong |

**Optional fields:** `tags` (array of strings), `queryId` (string), `ttl` (seconds until stale), `correlationId` (for tracing across Zgents).

**Reading a narrative log:**

```bash
# Human: display DReader's narrative in a tmux pane
tail -f /var/log/moo/dreader-narrative.jsonl | jq -r '[.ts[11:19], .from, .content] | join(" | ")'

# Agent: subscribe and filter by tag
tail -f /var/log/moo/dreader-narrative.jsonl | while read -r line; do
    if echo "$line" | jq -e '.tags | index("spx")' > /dev/null 2>&1; then
        echo "$line" | jq -r '.content'
    fi
done

# Agent: programmatic subscription using inotifywait for lower latency
inotifywait -m -e modify /var/log/moo/dreader-narrative.jsonl | while read -r; do
    tail -n 1 /var/log/moo/dreader-narrative.jsonl
done
```

**Pros:** Simple, reliable, inspectable with standard Unix tools, survives restarts (log is on disk), works with the existing AOE logging infrastructure.

**Cons:** Polling overhead unless using inotifywait, no delivery acknowledgment, files grow without bound, not suitable for high-frequency (>10 msg/sec) exchange.

---

### Layer 1: tmux-native (capture-pane, send-keys, hooks)

**Status:** Mechanisms available natively in tmux. No Gas Town implementation yet.

This layer provides **real-time co-presence awareness** -- agents knowing what other agents are doing right now, and reacting to session-level events.

**Pane observation -- reading another agent's display:**

```bash
# What is DReader currently showing?
output=$(tmux capture-pane -t dreader:main.0 -p -S -30)

# Parse it (fragile -- depends on DReader's display format)
echo "$output" | grep "SPX" | tail -1
```

**Command injection -- sending input to another agent:**

```bash
# Tell DReader to run a query
tmux send-keys -t dreader:main.0 '/query volume SPX' Enter

# Wait for output to appear, then capture
sleep 2
tmux capture-pane -t dreader:main.0 -p -S -5
```

**Hook-driven event flow:**

```bash
# When any pane dies, log it to the MOO event stream
tmux set-hook -g pane-died \
  'run-shell "echo {\"ts\":\"$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ)\",\"event\":\"pane-died\",\"pane\":\"#{pane_id}\"} >> /var/log/moo/events.jsonl"'

# When a human attaches to the ops session, notify agents
tmux set-hook -t moo-ops client-attached \
  'run-shell "echo {\"ts\":\"$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ)\",\"event\":\"human-arrived\",\"client\":\"#{client_name}\"} >> /var/log/moo/presence.jsonl"'

# Activity monitoring -- know when a quiet pane becomes active
tmux set-option -t dreader:main.0 monitor-activity on
tmux set-hook -t dreader alert-activity \
  'run-shell "/usr/local/bin/moo-notify dreader activity"'
```

**Combining Layer 0 and Layer 1:**

The most common pattern is Layer 0 for data and Layer 1 for awareness:

```bash
# Layer 0: DReader writes structured data to its narrative log
# Layer 1: A tmux pane formats and displays that data in real time
# Layer 1: Hooks detect when a human is watching, adjusting verbosity

# Human-facing pane setup
tmux send-keys -t moo-steve:main.1 \
  "tail -f /var/log/moo/dreader-narrative.jsonl | jq -r '\"[\" + .ts[11:19] + \"] \" + .content'" Enter
```

**Pros:** Zero additional infrastructure, native to the tmux environment, real-time event awareness, supports the "room" metaphor naturally.

**Cons:** Unstructured for pane observation (raw terminal text), fragile to display changes, send-keys has race conditions, hooks have limited error handling.

---

### Layer 2: Direct IPC (Named Pipes or Unix Sockets)

**Status:** Not implemented. Design only.

For specific agent pairs that need low-latency, structured, request/response communication. The typical case: one agent needs to query another agent's data and get a structured response within milliseconds.

**Named pipe approach:**

```bash
#!/bin/bash
# dreader-inbox-listener.sh -- DReader's query handler

INBOX="/var/moo/dreader-inbox"
[ -p "$INBOX" ] || mkfifo "$INBOX"
chmod 660 "$INBOX"

echo "DReader inbox listening at $INBOX"

while true; do
    if read -r msg < "$INBOX"; then
        method=$(echo "$msg" | jq -r '.method')
        id=$(echo "$msg" | jq -r '.id')
        reply_to=$(echo "$msg" | jq -r '.replyTo')

        case "$method" in
            query)
                symbol=$(echo "$msg" | jq -r '.params.symbol')
                result=$(dreader_lookup "$symbol")
                echo "{\"id\":\"$id\",\"result\":$result}" > "/var/moo/${reply_to}-inbox"
                ;;
            *)
                echo "{\"id\":\"$id\",\"error\":\"unknown method: $method\"}" > "/var/moo/${reply_to}-inbox"
                ;;
        esac
    fi
done
```

**Unix socket approach (Node.js):**

```typescript
import { createServer, createConnection } from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';

const SOCKET_PATH = '/var/moo/dreader.sock';

// Server side (DReader)
if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH);

const server = createServer((conn) => {
  let buffer = '';

  conn.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const request = JSON.parse(line);
      const response = handleRequest(request);
      conn.write(JSON.stringify(response) + '\n');
    }
  });
});

server.listen(SOCKET_PATH);

// Client side (ParseClipmate querying DReader)
function queryDReader(method: string, params: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const conn = createConnection(SOCKET_PATH);
    let buffer = '';

    conn.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes('\n')) {
        const response = JSON.parse(buffer.split('\n')[0]);
        resolve(response);
        conn.end();
      }
    });

    conn.write(JSON.stringify({
      id: `q-${Date.now()}`,
      method,
      params,
    }) + '\n');
  });
}
```

**Wire protocol (JSON-RPC style):**

Request:
```json
{"id": "q-123", "method": "query", "params": {"type": "volume", "symbol": "SPX"}}
```

Response (success):
```json
{"id": "q-123", "result": {"volume": 125000, "timestamp": "2026-02-12T10:00:00Z"}}
```

Response (error):
```json
{"id": "q-123", "error": {"code": -32601, "message": "Method not found: subscribe"}}
```

**Pros:** Fast (<10ms round-trip), structured request/response, bidirectional (sockets), supports concurrent clients (sockets).

**Cons:** Requires process management (listener must be running), stale socket/pipe cleanup on crash, more complex error handling, not inspectable with simple Unix tools like `tail`.

---

## 4. Discovery and Addressing

How does one Zgent find another? Three mechanisms, from static to dynamic.

### 4.1 Convention-based (Zero Configuration)

If you know the Zgent's name, you know its addresses:

| Resource | Path |
|----------|------|
| Narrative log | `/var/log/moo/{name}-narrative.jsonl` |
| Operational log | `~/.zgents/logs/{name}/` |
| Named pipe inbox | `/var/moo/{name}-inbox` |
| Unix socket | `/var/moo/{name}.sock` |
| tmux session | `{name}` or `agents-{name}` |
| tmux pane | `{name}:main.0` |

This is the primary discovery mechanism. Convention-based addressing means no registry lookups, no DNS, no service mesh. It works because the namespace is small (tens of Zgents, not thousands) and naming is controlled by the COO.

### 4.2 Registry File (Capability Discovery)

For cases where an agent needs to discover *what* another agent can do, not just *where* it is.

**Location:** `/var/moo/registry.json`

```json
{
  "schemaVersion": 1,
  "zgents": {
    "dreader": {
      "name": "DReader",
      "session": "dreader",
      "pane": "dreader:main.0",
      "log": "/var/log/moo/dreader-narrative.jsonl",
      "inbox": "/var/moo/dreader-inbox",
      "socket": "/var/moo/dreader.sock",
      "capabilities": [
        "query:volume",
        "query:sentiment",
        "query:history",
        "subscribe:narrative"
      ],
      "status": "active",
      "lastSeen": "2026-02-12T10:00:00Z"
    },
    "parseclipmate": {
      "name": "ParseClipmate",
      "session": "parseclipmate",
      "pane": "parseclipmate:main.0",
      "log": "/var/log/moo/parseclipmate-narrative.jsonl",
      "inbox": "/var/moo/parseclipmate-inbox",
      "capabilities": [
        "query:clip-search",
        "query:clip-summary",
        "subscribe:narrative"
      ],
      "status": "active",
      "lastSeen": "2026-02-12T10:00:00Z"
    }
  }
}
```

**Relationship to existing AOE registry:** The AOE already maintains `~/.zgents/registry.json` with Zgent identifiers, log directories, and last-active timestamps. The `/var/moo/registry.json` extends this with communication-specific fields (capabilities, channel addresses). Long-term, these should converge into a single registry.

**Capabilities format:** Capabilities use a `verb:noun` syntax:
- `query:volume` -- this Zgent can answer volume queries
- `query:sentiment` -- this Zgent can answer sentiment queries
- `subscribe:narrative` -- this Zgent's narrative log is available for tailing

### 4.3 tmux Session Listing (Dynamic Discovery)

For finding which Zgents are currently running:

```bash
# List all active Zgent sessions
tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -v '^moo-'

# List all panes across all sessions with their commands
tmux list-panes -a -F '#{session_name}:#{window_name}.#{pane_index} #{pane_current_command}'

# Check if a specific Zgent is running
tmux has-session -t dreader 2>/dev/null && echo "DReader is up" || echo "DReader is down"
```

This is useful for health checking and for building dynamic views, but it only tells you what sessions exist -- not what capabilities they expose.

---

## 5. Message Patterns

Four patterns cover the communication needs identified across the Zgent ecosystem.

### 5.1 Fire-and-Forget (Narrative)

An agent publishes a message to its narrative log. Zero coupling to consumers. Consumers may or may not be listening.

```
  DReader                         Narrative Log                      Subscriber(s)
     |                                |                                    |
     |--- append JSONL entry -------->|                                    |
     |                                |<--------- tail -f ----------------|
     |                                |--- new line event --------------->|
     |                                |                                    |
```

**When to use:** Status updates, observations, market signals, error reports -- anything where the publisher should not care whether anyone is listening.

**Example:**

```bash
# DReader publishes (fire and forget)
cat >> /var/log/moo/dreader-narrative.jsonl <<'EOF'
{"ts":"2026-02-12T14:30:00Z","from":"dreader","type":"narrative","content":"Unusual options activity: SPX 5900C sweep 2000 contracts","tags":["spx","options","unusual-activity"]}
EOF
```

### 5.2 Request-Response (Query)

One agent sends a structured query to another and waits for a response. Requires a return channel.

```
  ParseClipmate                    DReader Inbox                     DReader
       |                               |                               |
       |--- write query msg ---------->|                               |
       |                               |--- read from inbox ---------->|
       |                               |                               |
       |                               |          (process query)      |
       |                               |                               |
  ParseClipmate Inbox              <---|--- write response ------------|
       |<--- read response ------------|                               |
       |                               |                               |
```

**When to use:** One agent needs specific data from another: "What was SPX volume at 14:30?" or "Give me the last 10 Discord messages mentioning gamma."

**Example (via named pipes):**

```bash
# ParseClipmate sends query
echo '{"id":"q-456","method":"query","params":{"type":"history","symbol":"SPX","since":"2026-02-12T14:00:00Z"},"replyTo":"parseclipmate"}' \
  > /var/moo/dreader-inbox

# ParseClipmate waits for response
read -r response < /var/moo/parseclipmate-inbox
echo "$response" | jq '.result'
```

**Example (via Unix socket):**

```bash
echo '{"id":"q-456","method":"query","params":{"type":"history","symbol":"SPX","since":"2026-02-12T14:00:00Z"}}' \
  | socat - UNIX-CONNECT:/var/moo/dreader.sock
```

### 5.3 Subscription (Event Stream)

An agent continuously monitors another agent's narrative log, filtering for relevant messages. Like fire-and-forget from the consumer's perspective.

```
  ParseClipmate                   DReader Narrative Log
       |                                  |
       |-------- tail -f ---------------->|
       |                                  |
       |<-------- line (tag: spx) --------|
       |           (process)              |
       |<-------- line (tag: gamma) ------|
       |           (ignore - no match)    |
       |<-------- line (tag: spx) --------|
       |           (process)              |
       |                                  |
```

**When to use:** An agent needs ongoing awareness of another agent's output, filtered by topic. ParseClipmate subscribes to DReader's SPX-tagged narrative to build a market context window.

**Example:**

```bash
# Subscribe to DReader's SPX narratives
tail -f /var/log/moo/dreader-narrative.jsonl \
  | jq --unbuffered -r 'select(.tags // [] | index("spx")) | .content'
```

**Programmatic subscription (Node.js):**

```typescript
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { watch } from 'node:fs';

function subscribe(
  zgentId: string,
  filter: (msg: NarrativeMessage) => boolean,
  handler: (msg: NarrativeMessage) => void
): void {
  const logPath = `/var/log/moo/${zgentId}-narrative.jsonl`;
  let position = 0;

  // Watch for file changes
  watch(logPath, () => {
    const stream = createReadStream(logPath, { start: position });
    const rl = createInterface({ input: stream });

    rl.on('line', (line) => {
      position += Buffer.byteLength(line) + 1;
      try {
        const msg = JSON.parse(line);
        if (filter(msg)) handler(msg);
      } catch { /* skip malformed lines */ }
    });
  });
}

// Usage
subscribe('dreader',
  (msg) => msg.tags?.includes('spx') ?? false,
  (msg) => console.log(`DReader says: ${msg.content}`)
);
```

### 5.4 Broadcast (Announcement)

A message intended for all active Zgents. Written to a shared broadcast log that every Zgent monitors.

```
  Orchestrator                   Broadcast Log                   All Zgents
       |                              |                              |
       |--- append broadcast -------->|                              |
       |                              |<--------- tail -f -----------|
       |                              |--- new line ----------------->|
       |                              |                     (each processes)
```

**When to use:** System-wide announcements: "Market is closed," "Entering maintenance mode," "New Zgent joined the ecosystem."

**Broadcast log:** `/var/log/moo/broadcast.jsonl`

```json
{"ts":"2026-02-12T16:00:00Z","from":"orchestrator","type":"broadcast","content":"Market closed. Switching to review mode.","priority":"normal"}
```

```json
{"ts":"2026-02-12T16:05:00Z","from":"orchestrator","type":"broadcast","content":"New Zgent registered: gamma-watch","priority":"info","meta":{"zgentId":"gamma-watch","capabilities":["query:gamma-exposure"]}}
```

---

## 6. DReader to Narrative Log to tmux Pane Pipeline

A concrete end-to-end example showing all layers working together.

### The Scenario

1. DReader collects messages from Discord channels about SPX trading
2. DReader writes structured entries to its narrative log
3. A tmux pane displays DReader's narrative in real time for the human
4. ParseClipmate subscribes to DReader's narrative for market signal extraction
5. The human sees both agents' narratives in adjacent panes

### The Flow

```
+------------------------------------------------------------------+
|                                                                    |
|  Discord API                                                       |
|       |                                                            |
|       v                                                            |
|  +----------+     append JSONL      +-------------------------+    |
|  | DReader  |--------------------->| dreader-narrative.jsonl  |    |
|  | (agent)  |                      +-------------------------+    |
|  +----------+                           |              |           |
|       |                                 |              |           |
|       | (also writes to                 |              |           |
|       |  its tmux pane)                 |              |           |
|       v                                 v              v           |
|  +-----------+                   +------------+  +-------------+   |
|  | dreader   |                   | moo-steve  |  |ParseClipmate|   |
|  | :main.0   |                   | :main.1    |  | (agent)     |   |
|  | [agent    |                   | [tail -f   |  | [tail -f    |   |
|  |  console] |                   |  | jq]     |  |  | filter]  |   |
|  +-----------+                   +------------+  +-------------+   |
|                                        |              |            |
|                                        v              v            |
|                                   Human sees      ParseClipmate   |
|                                   formatted       extracts SPX    |
|                                   narrative       signals and     |
|                                                   writes to its   |
|                                                   own narrative   |
|                                                        |          |
|                                                        v          |
|                                              +------------------+ |
|                                              | parseclipmate-   | |
|                                              | narrative.jsonl  | |
|                                              +------------------+ |
|                                                        |          |
|                                                        v          |
|                                                   +------------+  |
|                                                   | moo-steve  |  |
|                                                   | :main.2    |  |
|                                                   | [tail -f   |  |
|                                                   |  | jq]     |  |
|                                                   +------------+  |
|                                                        |          |
|                                                        v          |
|                                                   Human sees      |
|                                                   ParseClipmate   |
|                                                   analysis        |
+------------------------------------------------------------------+
```

### Setup Commands

```bash
# === Background: Agent sessions (headless) ===

# Start DReader agent session
tmux new-session -d -s dreader
tmux send-keys -t dreader:0 'dreader --channel spx-flow --output /var/log/moo/dreader-narrative.jsonl' Enter

# Start ParseClipmate agent session
tmux new-session -d -s parseclipmate
tmux send-keys -t parseclipmate:0 'parseclipmate --subscribe /var/log/moo/dreader-narrative.jsonl --filter "spx" --output /var/log/moo/parseclipmate-narrative.jsonl' Enter

# === Foreground: Human view session ===

# Create Steve's view session with 3 panes
tmux new-session -d -s moo-steve -n main
tmux split-window -t moo-steve:main -h
tmux split-window -t moo-steve:main.1 -v

# Pane 0: Command input (left)
# Pane 1: DReader narrative (top right)
tmux send-keys -t moo-steve:main.1 \
  "tail -f /var/log/moo/dreader-narrative.jsonl | jq --unbuffered -r '\"[\" + .ts[11:19] + \"] \" + .content'" Enter

# Pane 2: ParseClipmate analysis (bottom right)
tmux send-keys -t moo-steve:main.2 \
  "tail -f /var/log/moo/parseclipmate-narrative.jsonl | jq --unbuffered -r '\"[\" + .ts[11:19] + \"] \" + .content'" Enter

# Human attaches
tmux attach -t moo-steve
```

### What Steve Sees

```
+----------------------------+----------------------------+
|                            | [14:30:01] SPX volume spike|
|  $ _                       |   detected at 5835         |
|                            | [14:30:05] Unusual options |
|  (command input)           |   activity: SPX 5900C      |
|                            |   sweep 2000 contracts     |
|                            +----------------------------+
|                            | [14:30:02] SIGNAL: Volume  |
|                            |   anomaly SPX - 3.2x avg  |
|                            | [14:30:06] SIGNAL: Large   |
|                            |   call sweep SPX 5900      |
|                            |   bullish positioning      |
+----------------------------+----------------------------+
```

DReader's raw observations flow down the left narrative pane. ParseClipmate's processed signals flow down the right. Steve sees both in real time, with the structured pipeline invisible beneath.

---

## 7. Security and Isolation

All inter-Zgent communication is **local IPC** -- nothing crosses a network boundary. Security is about preventing accidental interference, not defending against adversaries.

### File Permissions

```bash
# Narrative logs: writable by owning Zgent, readable by all Zgents
-rw-r--r-- dreader zgents /var/log/moo/dreader-narrative.jsonl

# Named pipe inboxes: writable by Zgent group, readable by owner only
prw-rw---- dreader zgents /var/moo/dreader-inbox

# Unix sockets: accessible by Zgent group
srwxrwx--- dreader zgents /var/moo/dreader.sock

# Registry: readable by all, writable by orchestrator
-rw-r--r-- root zgents /var/moo/registry.json

# Broadcast log: writable by orchestrator, readable by all
-rw-r--r-- root zgents /var/log/moo/broadcast.jsonl
```

### tmux Session Isolation

By default, tmux sessions are isolated per user. A Zgent running as `dreader` cannot access sessions owned by `parseclipmate` unless both are running under the same user or explicit access is configured.

In the Gas Town model, all Zgents run as `gtuser`, which means they share a tmux server. This is by design -- it enables `capture-pane` and `send-keys` across agents. To restrict access:

```bash
# Read-only access: use capture-pane but not send-keys
# (Enforced by convention, not by tmux -- tmux has no per-pane ACL)
```

### What Is NOT Protected

- **Narrative logs are world-readable.** Any Zgent can read any other Zgent's narrative. This is intentional -- narrative is public speech.
- **tmux send-keys has no ACL.** Any process with access to the tmux server can inject keystrokes into any pane. This is a known limitation. The mitigation is running agents under a shared user with trust between them.
- **Named pipes and sockets rely on Unix permissions.** A misconfigured pipe can be read by unintended processes.

### Recommendations

1. All Zgents run as `gtuser` (current Gas Town convention) -- this simplifies permissions at the cost of isolation.
2. Narrative logs are append-only by convention. Agents should never truncate or modify another agent's log.
3. If stronger isolation is needed later, run Zgents under separate Unix users and use group permissions for communication channels.

---

## 8. Trade-offs and Recommendations

### Comparison Matrix

| Criterion | File-based (L0) | tmux-native (L1) | Named Pipes (L2a) | Unix Sockets (L2b) |
|-----------|-----------------|-------------------|--------------------|--------------------|
| **Latency** | ~50ms | ~100ms | <10ms | <5ms |
| **Reliability** | High | Medium | Medium | High |
| **Structured data** | Yes (JSONL) | No (raw text) | Yes (JSON) | Yes (JSON) |
| **Persistence** | Yes (on disk) | No (scrollback only) | No | No |
| **Complexity** | Low | Low | Medium | High |
| **Bidirectional** | No | Yes (via send-keys) | No (per pipe) | Yes |
| **Concurrent clients** | Yes (multiple tailers) | Yes | No (one reader) | Yes |
| **Inspectable** | Yes (`cat`, `jq`, `tail`) | Yes (`capture-pane`) | Requires reader | Requires client |
| **Survives restart** | Yes | No | No | No |
| **Infrastructure** | None (filesystem) | None (tmux built-in) | `mkfifo` per agent | Server process per agent |
| **Delivery guarantee** | At-most-once (poll) | None | At-most-once | Exactly-once (per connection) |

### Recommendation: Progressive Layering

**Start with Layer 0 for everything.** Narrative logs are the right default because:
- They already exist in the Gas Town ecosystem (ZgentTransport)
- They are inspectable with standard Unix tools
- They survive restarts -- an agent can catch up on what it missed
- They provide a complete audit trail

**Add Layer 1 for presence awareness.** When you need to know:
- Is another agent running? (`tmux has-session`)
- What is another agent displaying right now? (`capture-pane`)
- Did a human just arrive? (`client-attached` hook)

**Graduate to Layer 2 only for specific, latency-sensitive pairs.** The canonical case: ParseClipmate needs to query DReader's historical data with <10ms response time for real-time signal processing. Most agent interactions do not have this requirement.

### When NOT to Use Each Layer

| Layer | Do NOT use when |
|-------|----------------|
| L0 (files) | You need sub-50ms response time, or you need request/response semantics |
| L1 (tmux) | You need structured data exchange, or the target agent's display format may change |
| L2a (pipes) | You need multiple readers, or bidirectional communication |
| L2b (sockets) | The added complexity of running a socket server is not justified by latency requirements |

---

## 9. Implementation Roadmap

### Phase 1: Narrative Log Convention (Now)

**What:** Standardize the narrative log format and paths.

- Define the JSONL schema documented in Section 3, Layer 0
- Extend `ZgentTransport` to write to `/var/log/moo/{zgent}-narrative.jsonl` in addition to the operational log at `~/.zgents/logs/`
- Create `/var/log/moo/` directory with appropriate permissions
- Write a simple `moo-tail` utility that formats narrative logs for human consumption:
  ```bash
  #!/bin/bash
  # moo-tail: tail a Zgent's narrative log with formatting
  tail -f "/var/log/moo/${1}-narrative.jsonl" | jq --unbuffered -r '"[\(.ts[11:19])] \(.content)"'
  ```

**Validates:** File-based message passing works. Multiple consumers can tail one log. Format is stable and useful.

**Depends on:** Nothing. Can be done immediately.

### Phase 2: Hook Wiring for Event-Driven Awareness (With Zgent Session Spec)

**What:** Wire tmux hooks to the narrative log system.

- Define a standard set of hooks that every Zgent session installs
- Hooks write to `/var/log/moo/{zgent}-events.jsonl` (separate from narrative)
- Create `/var/log/moo/presence.jsonl` for session-level events (attach, detach, pane-died)
- Build a `moo-hooks-install` script that configures hooks for a Zgent session

**Validates:** tmux events flow into the same logging infrastructure. Agents can react to presence changes.

**Depends on:** Phase 1 (narrative log convention established), Zgent Session Spec (defines what sessions look like).

### Phase 3: First Real Inter-Zgent Query (With DReader Integration)

**What:** DReader and a consuming agent exchange structured queries via the file-based protocol.

- DReader publishes its narrative log with tags
- A second agent (ParseClipmate or equivalent) subscribes to DReader's log, filtered by tags
- Implement request/response over files: requester writes to `dreader-queries.jsonl`, DReader watches and writes responses to its narrative log with matching `queryId`
- Measure end-to-end latency from query to response

**Validates:** Two real Zgents communicating through the file-based layer. Identifies whether file-based query/response is fast enough or Layer 2 is needed.

**Depends on:** Phase 1, a working DReader that writes narrative logs.

### Phase 4: Direct IPC for Latency-Sensitive Pairs (Later)

**What:** Named pipe or Unix socket layer for agent pairs where file-based latency is insufficient.

- Implement inbox listener pattern (named pipes) for DReader
- If bidirectional is needed, implement socket server for DReader
- Integrate with the registry so other agents can discover DReader's IPC channels
- Benchmark: pipe vs. socket vs. file-based for the same query workload

**Validates:** IPC layer works and provides meaningful latency improvement over file-based.

**Depends on:** Phase 3 (to know whether IPC is actually needed based on real usage patterns).

### Phase 5: Registry Convergence (Later)

**What:** Merge the AOE registry (`~/.zgents/registry.json`) with the MOO registry (`/var/moo/registry.json`) into a single source of truth.

- Define unified registry schema covering identity, logs, communication channels, and capabilities
- Migration path from current AOE registry
- Auto-registration: Zgents register their channels on startup, deregister on shutdown
- Health checking: mark stale entries when a Zgent has not updated `lastSeen` within a threshold

**Depends on:** Phases 1-4 (to understand what fields the registry actually needs from real usage).

---

## 10. Relation to Convergence Map

The convergence analysis (`presentations/convergence-map/`) identified seven structural connections across the Gas Town ecosystem and four gaps. This communication design directly addresses the gaps.

### Gap 3: Replay Adapter

The convergence map noted: *"Traffic log to tmuxMOO replay adapter does not exist (data and display are disconnected)."*

This design bridges that gap. The pipeline is:

```
CrudEngine traffic logs  --->  narrative JSONL  --->  tmux pane display
   (structured ops data)      (curated stream)        (human-readable)
```

The narrative log IS the replay adapter. CrudEngine's audit trail can be formatted as narrative JSONL. A tmux pane tailing that JSONL displays the replay. The three pieces -- data source, intermediate format, display surface -- are connected by the same JSONL convention.

### Connection 2: Rooms All the Way Down

The convergence map observed that "pane, log directory, scene, context profile" are four names for one primitive: `BoundedEnvironment`. Inter-Zgent communication reinforces this:

- A **pane** is where an agent's output is visible (Layer 1)
- A **log directory** is where an agent's communication is stored (Layer 0)
- A **scene** (from AOE) defines which agents participate and how
- A **context profile** determines what each agent sees and can do

Communication channels are the **edges** between these bounded environments. The rooms are the nodes; the comms are the connections.

### Connection 3: Traffic Logs = Narrative Replay

CrudEngine produces structured traffic logs of every CRUD operation. These logs have the same shape as narrative JSONL entries: timestamped, attributed to a source, containing structured content. The design in this document means CrudEngine traffic logs can flow directly into the narrative log pipeline with minimal transformation:

```json
{"ts":"2026-02-12T10:00:00Z","from":"crudengine","type":"narrative","content":"Created skill: dreader-query-handler","tags":["crud","skill","create"]}
```

A tmux pane tailing this log shows CrudEngine operations in real time -- the replay adapter the convergence map identified as missing.

### Zgent Session Spec: The `comms` Section

When the Zgent Session Spec is formalized, each Zgent's definition should include a `comms` section declaring which channels it uses:

```yaml
# dreader-session.yaml (hypothetical)
zgent: dreader
session: dreader
pane: dreader:main.0
comms:
  narrative: /var/log/moo/dreader-narrative.jsonl
  events: /var/log/moo/dreader-events.jsonl
  inbox: /var/moo/dreader-inbox          # Phase 4
  socket: /var/moo/dreader.sock          # Phase 4
  capabilities:
    - query:volume
    - query:sentiment
    - query:history
    - subscribe:narrative
```

This ties the communication design back to the ECC/AOE infrastructure: the session spec is a configuration artifact that CrudEngine manages, and the `comms` section is the inter-Zgent communication contract.

---

## Appendix A: Directory and File Layout

Complete filesystem layout for the inter-Zgent communication system:

```
/var/moo/                              # MOO runtime directory
    registry.json                      # Zgent registry (capability discovery)
    broadcast.jsonl                    # System-wide broadcast log
    dreader-inbox                      # Named pipe: DReader's inbox (Phase 4)
    dreader.sock                       # Unix socket: DReader's IPC (Phase 4)
    parseclipmate-inbox                # Named pipe: ParseClipmate's inbox
    parseclipmate.sock                 # Unix socket: ParseClipmate's IPC

/var/log/moo/                          # MOO log directory
    dreader-narrative.jsonl            # DReader's public narrative stream
    dreader-events.jsonl               # DReader's tmux hook events
    parseclipmate-narrative.jsonl      # ParseClipmate's public narrative
    parseclipmate-events.jsonl         # ParseClipmate's tmux hook events
    presence.jsonl                     # Session-level presence events
    broadcast.jsonl                    # (symlink to /var/moo/broadcast.jsonl)
    events.jsonl                       # Global tmux event stream

~/.zgents/                             # Existing AOE convention
    registry.json                      # AOE Zgent registry (operational)
    logs/
        dreader/
            2026-02-12T10-00-00.jsonl  # Full operational log
        parseclipmate/
            2026-02-12T10-00-00.jsonl  # Full operational log
```

## Appendix B: Message Schema Reference

### Narrative Message

```typescript
interface NarrativeMessage {
  /** ISO 8601 timestamp */
  ts: string;
  /** Zgent identifier */
  from: string;
  /** Message type */
  type: 'narrative' | 'query-response' | 'status' | 'alert' | 'error';
  /** Payload: free-form string or structured object */
  content: string | Record<string, unknown>;
  /** Optional topic tags for filtering */
  tags?: string[];
  /** For query-response: ID of the originating query */
  queryId?: string;
  /** Correlation ID for tracing across Zgents */
  correlationId?: string;
  /** Seconds until this message should be considered stale */
  ttl?: number;
}
```

### Query Request (Layer 2)

```typescript
interface QueryRequest {
  /** Unique request ID */
  id: string;
  /** Method name (matches a declared capability) */
  method: string;
  /** Method parameters */
  params: Record<string, unknown>;
  /** For named pipe protocol: which inbox to reply to */
  replyTo?: string;
}
```

### Query Response (Layer 2)

```typescript
interface QueryResponse {
  /** Matches the request ID */
  id: string;
  /** Successful result (mutually exclusive with error) */
  result?: Record<string, unknown>;
  /** Error details (mutually exclusive with result) */
  error?: {
    code: number;
    message: string;
  };
}
```

### Broadcast Message

```typescript
interface BroadcastMessage {
  /** ISO 8601 timestamp */
  ts: string;
  /** Source of the broadcast (usually 'orchestrator') */
  from: string;
  /** Always 'broadcast' */
  type: 'broadcast';
  /** The announcement */
  content: string;
  /** Urgency level */
  priority: 'info' | 'normal' | 'urgent';
  /** Optional structured metadata */
  meta?: Record<string, unknown>;
}
```
