export type Role = "system" | "user" | "assistant" | "tool";

export type Message = {
  role: Role;
  content: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object;
  };
};

export type ToolHandler = (args: unknown) => Promise<string>;

export type Tool = {
  def: ToolDefinition;
  handler: ToolHandler;
};

export type ConfirmResult =
  | { kind: "approve" }
  | { kind: "replan"; feedback: string }
  | { kind: "quit" };
