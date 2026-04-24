const THINKING_MODELS = new Set(['qwen3.5:35b', 'qwen3.6', 'qwen3.5:9b'])

export const Config = {
  PROVIDER: 'ollama',
  HOST: 'http://host.docker.internal:11434',
  // MODEL: 'gpt-oss',
  // MODEL: 'qwen3.5:9b',
  // MODEL: 'qwen3.5:35b',
  MODEL: 'qwen3.6',
  LANGUAGE: 'russian',
  USE_PLAN_MODE: false,
  USE_DETAILED_COMMAND_EXPLANATION: false,
  USE_NATIVE_OLLAMA_TOOLS: true,
  USE_THINKING: true,
  SHOW_THINKING: true,
  USE_STREAMING: true,
  VERBOSE_TOOL_OUTPUT: false,
  WEB_SEARCH_MAX_RESULTS: 5,
  FETCH_URL_MAX_BYTES: 200_000,
  FETCH_URL_TIMEOUT_MS: 15_000,
  USE_PERMISSION_ALLOWLIST: true,
  AUTO_APPROVE_SHELL_PATTERNS: [
    /^(ls|pwd|cat|head|tail|wc|file|stat|which|echo|date|uname|whoami|id|env|tree)(\s|$)/,
    /^git (status|diff|log|show|branch|remote|rev-parse|blame|ls-files)(\s|$)/,
    /^(node|tsc|eslint|npm|pnpm|yarn|deno|bun) --version$/,
  ] as readonly RegExp[],
} as const

export type ThinkingMode = false | true | 'low' | 'medium' | 'high'

export function getThinkingModeFor(model: string): ThinkingMode {
  if (!Config.USE_THINKING) {
    return false
  }

  if (model === 'gpt-oss') {
    return 'high'
  }

  return THINKING_MODELS.has(model)
}
