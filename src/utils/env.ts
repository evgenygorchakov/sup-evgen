import process from 'node:process'

export function getEnvValue(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing env var: ${name}. Check .env file.`)
  }

  return value
}

export function parseEnvToBoolean(name: string): boolean {
  const value = getEnvValue(name)
  if (value === '1')
    return true

  return false
}

export function parseEnvToNumber(name: string): number {
  const value = getEnvValue(name)
  const number = Number(value)

  if (Number.isNaN(number))
    return 0

  return number
}
