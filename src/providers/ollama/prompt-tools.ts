import type { ToolCall, ToolDefinition } from '../../types.ts'

export interface PromptToolsReply {
  message: string
  tool_calls: ToolCall[]
}

export function buildToolsInstruction(tools: ToolDefinition[]): string {
  const schemas = tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }))

  return [
    'You have access to the following tools:',
    JSON.stringify(schemas),
    '',
    'Your reply is constrained to a JSON object with two fields:',
    '- "message": natural-language text for the user (empty string if you only want to call tools).',
    '- "tool_calls": array of calls you want to execute right now.',
    '',
    'Each entry in tool_calls must have:',
    '- "name": exactly one of the tool names listed above.',
    '- "arguments": object with the tool arguments matching its parameters schema.',
    '',
    'When you are done and want to answer the user, return an empty tool_calls array.',
    'Do not include tool output, commentary, or anything outside the JSON object.',
  ].join('\n')
}

export function buildReplyFormat(tools: ToolDefinition[]): object {
  const toolNames = tools.map(t => t.function.name)

  return {
    type: 'object',
    properties: {
      message: { type: 'string' },
      tool_calls: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: toolNames },
            arguments: { type: 'object' },
          },
          required: ['name', 'arguments'],
        },
      },
    },
    required: ['message', 'tool_calls'],
  }
}

export function parsePromptToolsReply(content: string): PromptToolsReply {
  const parsed: unknown = JSON.parse(content)

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Prompt-tools reply is not a JSON object')
  }

  const obj = parsed as { message?: unknown, tool_calls?: unknown }
  const message = typeof obj.message === 'string' ? obj.message : ''

  if (!Array.isArray(obj.tool_calls)) {
    return { message, tool_calls: [] }
  }

  const tool_calls: ToolCall[] = []
  for (const entry of obj.tool_calls) {
    if (
      typeof entry === 'object'
      && entry !== null
      && 'name' in entry
      && 'arguments' in entry
      && typeof (entry as { name: unknown }).name === 'string'
      && typeof (entry as { arguments: unknown }).arguments === 'object'
      && (entry as { arguments: unknown }).arguments !== null
    ) {
      const e = entry as { name: string, arguments: Record<string, unknown> }
      tool_calls.push({ function: { name: e.name, arguments: e.arguments } })
    }
  }

  return { message, tool_calls }
}

function tryOnce(raw: string): PromptToolsReply | null {
  try {
    return parsePromptToolsReply(raw)
  }
  catch {
    return null
  }
}

// Find the first balanced {...} block, respecting string literals and escapes.
function extractFirstJsonObject(content: string): string | null {
  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]

    if (inString) {
      if (escape)
        escape = false
      else if (ch === '\\')
        escape = true
      else if (ch === '"')
        inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      if (depth === 0)
        start = i
      depth++
    }
    else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return content.slice(start, i + 1)
      }
    }
  }

  return null
}

export function tryParsePromptToolsReply(content: string): PromptToolsReply | null {
  const strict = tryOnce(content)

  if (strict) {
    return strict
  }

  const trimmed = content.trim()
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = tryOnce(trimmed.slice(firstBrace, lastBrace + 1))

    if (sliced) {
      return sliced
    }
  }

  const balanced = extractFirstJsonObject(content)

  if (balanced) {
    const parsed = tryOnce(balanced)

    if (parsed) {
      return parsed
    }
  }

  return null
}
