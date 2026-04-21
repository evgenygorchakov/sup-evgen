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

export type ConfirmResult = | { kind: 'approve' } | { kind: 'replan', feedback: string } | { kind: 'quit' }
