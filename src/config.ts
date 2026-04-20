function getEnvValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}. Check .env file.`);
  }

  return value;
}

export const HOST = getEnvValue("OLLAMA_HOST");
export const MODEL = getEnvValue("OLLAMA_MODEL");
export const REQUEST_TIMEOUT_MS = 300_000;
export const MAX_ITERATIONS = 20;
