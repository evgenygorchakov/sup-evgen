import type { Message, OnStreamPart, ToolDefinition } from '../types.ts'

export interface ChatProvider {
  chat: (messages: Message[], tools: ToolDefinition[], onStreamPart?: OnStreamPart) => Promise<Message>
}
