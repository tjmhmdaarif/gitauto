/**
 * Environment configuration for the daily automation.
 * Load from environment variables or a .env file.
 */
export const ENV = {
  // Bot identity used in the digest header, email subject, and logs
  BOT_NAME: process.env.BOT_NAME || 'GITAUTO',

  // Google Gemini API key for AI summarization
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',

  // Webhook URL for Discord/Slack notification (optional)
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',

  // Email config for sending digest via email (optional)
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',

  // Comma-separated list of source names to fetch from
  SOURCES: (process.env.SOURCES || 'github,vercel,ai_skills').split(','),

  // Fetch limits per source (prevent fetching too many items)
  FETCH_LIMIT: Number(process.env.FETCH_LIMIT) || 20,

  // Minimum star count for repos/skills. 0 disables the filter.
  MIN_STARS: Number(process.env.MIN_STARS) || 30000,

  // Whether to run in dry-run mode (no actual sending)
  DRY_RUN: process.env.DRY_RUN === 'true',
};

export const SOURCES_CONFIG: Record<string, {
  type: 'github' | 'vercel' | 'ai_skill' | 'custom';
  query: string;
}> = {
  github: {
    type: 'github',
    query: 'ai agent',
  },
  vercel: {
    type: 'vercel',
    query: 'deployment guide',
  },
  'ai_skills': {
    type: 'ai_skill',
    query: 'skills',
  },
  custom: {
    type: 'custom',
    query: '',
  },
};