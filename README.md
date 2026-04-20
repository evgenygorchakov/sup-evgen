# agent

Minimal local CLI assistant. Sends a prompt to a local [Ollama](https://ollama.com) model, lets it propose shell commands, explains what it'll do, asks before running, and loops until the task is done.

```
$ sup "show files in the current folder"

<yellow — the model's explanation>

Model wants to run:
  run_shell({"command":"ls -la"})

[y / n / type feedback] y
```

## Setup

```bash
cp .env.example .env   # set OLLAMA_HOST, OLLAMA_MODEL, LANGUAGE
npm start -- "show files in the current folder"
```

`LANGUAGE` sets the response language for both the system prompt and the pre-confirmation explanation.

## Architecture

```
index.ts              # argv → system prompt → agent loop
src/
  agent.ts            # chat → explain → confirm → dispatch → repeat
  client/ollama.ts    # POST /api/chat with tools, validates response
  tools/run-shell.ts  # bash -c, 30 s timeout, 20 KB output cap
  types.ts
  utils/              # colors, env
```

## Flow

1. Send conversation to Ollama.
2. Plain text reply → print and exit.
3. `tool_calls` → second request (no tools) for an explanation.
4. Show explanation + command list; prompt `[y / n / type feedback]`.
5. `y` → run and loop. `n` / `no` / empty → quit. Any other text → treat as feedback, push it as a user message, model replans on the next iteration.
6. Hard stop at 20 iterations.

## Pros

- zero runtime deps.
- Every command shown and explained before running.
- Rejection is a conversation — give feedback, model replans.
- Timeouts and output caps on both sides.

## Cons

- Single tool (`run_shell`). No file API, no structured I/O.
- One-shot CLI; no interactive chat.
- Explain adds a round trip per confirmation (2–10 s on local).
- Shell output buffered in memory during streaming, capped only on close.
- No `tool_call_id` round-tripping; no retries on transient Ollama errors.

## Security

**The only gate is the `[y / n / type feedback]` prompt. Read every command before approving.**

- No sandbox — commands run with your full user privileges.
- The yellow explanation can mislead: always read the cyan command line, not just the summary.
- Shown-vs-executed mismatch is *not* a risk — the same `call` object is printed and dispatched.
- Command output feeds back into the model → prompt injection risk.
- Watch for `;`, `&&`, `||`, `|`, `>`, `>>`, `$(...)`, backticks, and non-ASCII in command strings.
- Trust boundary: `OLLAMA_HOST` must be trusted. For anything beyond read-only exploration, run inside a VM or container.
