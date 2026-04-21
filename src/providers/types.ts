import type { Message, OnChunk, ToolDefinition } from '../types.ts'

export interface ChatProvider {
  chat: (messages: Message[], tools: ToolDefinition[], onChunk?: OnChunk) => Promise<Message>
}
