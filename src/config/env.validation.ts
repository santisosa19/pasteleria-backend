const requiredEnvKeys = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

const durationKeys = [
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
] as const;

export function validateEnv(config: Record<string, unknown>) {
  for (const key of requiredEnvKeys) {
    const value = config[key];

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  for (const key of durationKeys) {
    const value = config[key];

    if (value !== undefined && typeof value !== 'string') {
      throw new Error(
        `Invalid ${key}. Expected a duration like 15m, 1h or 7d.`,
      );
    }

    if (value !== undefined && !/^\d+[smhd]$/.test(value)) {
      throw new Error(
        `Invalid ${key}. Expected a duration like 15m, 1h or 7d.`,
      );
    }
  }

  return config;
}
