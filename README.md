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
npm link
```

## Pros

- zero runtime deps.
- Every command shown and explained before running.
- Rejection is a conversation — give feedback, model replans.

## Security

**The only gate is the `[y / n / type feedback]` prompt. Read every command before approving.**
