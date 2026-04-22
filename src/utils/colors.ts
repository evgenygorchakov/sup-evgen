import process from 'node:process'

const RESET_CODE = '\x1B[0m'
const colorsEnabled = process.stderr.isTTY && !process.env.NO_COLOR

function createColorizer(ansiCode: string): (text: string) => string {
  if (!colorsEnabled) {
    return text => text
  }

  return text => `\x1B[${ansiCode}m${text}${RESET_CODE}`
}

export const bold = createColorizer('1')
export const gray = createColorizer('90')
export const red = createColorizer('31')
export const yellow = createColorizer('33')
export const brightGreen = createColorizer('92')
export const brightBlue = createColorizer('94')
