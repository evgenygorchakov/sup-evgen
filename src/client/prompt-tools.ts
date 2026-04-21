import type { ToolCall, ToolDefinition } from '../types.ts'

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
