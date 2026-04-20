import { gray } from "./utils/colors.ts";

type HookEvent = "preToolUse" | "postToolUse";
type HookPayload = { name: string; input?: unknown; output?: unknown };
type Hook = (event: HookEvent, payload: HookPayload) => Promise<void>;

const hooks: Hook[] = [
  async (event, payload) => {
    if (event === "preToolUse") {
      console.error(gray(`→ ${payload.name}(${JSON.stringify(payload.input)})`));
    }
  },
];

export async function emit(event: HookEvent, payload: HookPayload): Promise<void> {
  for (const hook of hooks) {
    await hook(event, payload);
  }
}
