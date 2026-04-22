export type Role = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: Role
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface StreamPart {
  content?: string
  thinking?: string
}

export type OnStreamPart = (part: StreamPart) => void

export interface ToolCall {
  id?: string
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

export type ToolHandler = (rawArguments: unknown) => Promise<string>

export interface Tool {
  definition: ToolDefinition
  handler: ToolHandler
}

export const CONFIRM_KIND = {
  approve: 'approve',
  replan: 'replan',
  quit: 'quit',
} as const

export type ConfirmResult
  = | { kind: typeof CONFIRM_KIND.approve }
    | { kind: typeof CONFIRM_KIND.replan, feedback: string }
    | { kind: typeof CONFIRM_KIND.quit }
