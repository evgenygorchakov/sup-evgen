export function getEnvValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env var: ${name}. Check .env file.`);
  }

  return value;
}
