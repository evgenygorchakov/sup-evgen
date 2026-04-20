const RESET = "\x1b[0m";

function wrap(code: string): (s: string) => string {
  return (s) => `\x1b[${code}m${s}${RESET}`;
}

export const bold = wrap("1");
export const gray = wrap("90");
export const red = wrap("31");
export const cyan = wrap("36");
export const yellow = wrap("33");
