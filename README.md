# Agent

Minimal local CLI assistant. Sends a prompt to a local [Ollama](https://ollama.com) model, lets it propose shell commands, explains what it'll do, asks before running, and loops until the task is done.

<img width="1959" height="331" alt="image" src="https://github.com/user-attachments/assets/83ecc6d8-82c0-40a5-92bc-8ae3a435b73a" />

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
