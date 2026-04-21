const RESET = '\x1B[0m'

function wrap(code: string): (s: string) => string {
  return s => `\x1B[${code}m${s}${RESET}`
}

export const bold = wrap('1')
export const gray = wrap('90')
export const red = wrap('31')
export const cyan = wrap('36')
export const yellow = wrap('33')
export const brightGreen = wrap('92')
export const brightBlue = wrap('94')
