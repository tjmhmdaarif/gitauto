/**
 * Environment configuration for the daily automation.
 * Load from environment variables or a .env file.
 */
export const ENV = {
  // Bot identity used in the digest header, email subject, and logs
  BOT_NAME: process.env.BOT_NAME || 'GITAUTO',

  // Google Gemini API key (only used when AI_PROVIDER=gemini)
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',

  // AI provider for enrichment/summarization:
  //   'openai' - any OpenAI-compatible chat-completions endpoint (default)
  //   'gemini' - Google Gemini via GOOGLE_API_KEY
  //   'none'   - never call a model; use the built-in heuristics only
  AI_PROVIDER: process.env.AI_PROVIDER || 'openai',

  // OpenAI-compatible endpoint (trailing slash optional)
  AI_BASE_URL: process.env.AI_BASE_URL || 'http://127.0.0.1:3001/v1',

  // API key for the OpenAI-compatible endpoint (empty = no auth)
  AI_API_KEY: process.env.AI_API_KEY || '',

  // Model id understood by the endpoint
  AI_MODEL: process.env.AI_MODEL || 'auto/best-fast',

  // Per-request timeout in milliseconds
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS) || 45000,

  // GitHub token for the search API (raises the rate limit; required on shared
  // CI IPs where the unauthenticated limit is easily exhausted)
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',

  // ntfy.sh topic for push delivery (optional)
  NTFY_TOPIC: process.env.NTFY_TOPIC || '',

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
  // Only applied to sources that report star counts (GitHub); feeds without
  // star data (Vercel) are never skipped by this value.
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