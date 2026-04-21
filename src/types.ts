export type Role = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: Role
  content: string
  tool_calls?: ToolCall[]
}

export interface ToolCall {
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

export type ToolHandler = (args: unknown) => Promise<string>

export interface Tool {
  def: ToolDefinition
  handler: ToolHandler
}

export const CONFIRM_KIND = {
  approve: 'approve',
  replan: 'replan',
  quit: 'quit',
} as const

export type ConfirmKind = (typeof CONFIRM_KIND)[keyof typeof CONFIRM_KIND]

export type ConfirmResult
  = | { kind: typeof CONFIRM_KIND.approve }
    | { kind: typeof CONFIRM_KIND.replan, feedback: string }
    | { kind: typeof CONFIRM_KIND.quit }
