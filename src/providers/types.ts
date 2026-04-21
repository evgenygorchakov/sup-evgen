import type { Message, ToolDefinition } from '../types.ts'

export interface ChatProvider {
  chat: (messages: Message[], tools: ToolDefinition[]) => Promise<Message>
}
