# Agent

A minimal local CLI assistant. It sends a prompt to a local [Ollama](https://ollama.com) model, lets it propose shell commands, explains what it will do, asks for confirmation before running, and loops until the task is complete.

## Setup

1. Install and launch [Ollama](https://ollama.com)
2. Download a model
3. Clone the repository and open the project
4. Change `src/config.ts` if needed (e.g., to select the downloaded model)
5.
```bash
npm link
```

## Usage. For example model: qwen3.6 with thinking high mode:
https://github.com/user-attachments/assets/ef41b487-df7d-4b33-a0af-47c0d67cbfb1

## Pros

- Zero runtime dependencies.
- Every command is shown and explained before execution.
- Rejection becomes a conversation — provide feedback and the model will replan.

## Security

**The only safeguard is the `[y / n / type feedback]` prompt. Read every command before approving.**
