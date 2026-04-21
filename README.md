# Agent

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
npm install (only for dev mode)
npm link
```

## Flow

1. Send conversation to Ollama.
2. Plain text reply → print and exit.
3. `tool_calls` → second request (no tools) for an explanation.
4. Show explanation + command list; prompt `[y / n / type feedback]`.
5. `y` → run and loop. `n` / `no` / empty → quit. Any other text → treat as feedback, push it as a user message, model replans on the next iteration.

## Pros

- zero runtime deps.
- Every command shown and explained before running.
- Rejection is a conversation — give feedback, model replans.

## Cons

- Single tool (`run_shell`). No file API, no structured I/O.
- One-shot CLI; no interactive chat.
- Explain adds a round trip per confirmation (2–10 s on local).
- Shell output buffered in memory during streaming, capped only on close.

## Security

**The only gate is the `[y / n / type feedback]` prompt. Read every command before approving.**
