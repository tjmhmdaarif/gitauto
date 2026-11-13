/**
 * AI client for enrichment and summarization.
 *
 * Providers:
 *   - 'openai'  any OpenAI-compatible /chat/completions endpoint. The default
 *               points at the local omniroute gateway (http://127.0.0.1:3001/v1),
 *               which is always on the machine and needs no external billing.
 *   - 'gemini'  Google Gemini via GOOGLE_API_KEY.
 *
 * Every entry point throws AiError when the provider is unavailable. Callers are
 * expected to catch it and fall back to heuristics, so a dead gateway or an
 * expired key must never abort the pipeline or cost us the digest.
 */
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from './config.js';

export class AiError extends Error {}

interface ChatOptions {
  json?: boolean;
  maxTokens?: number;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
}

async function openAiChat(prompt: string, opts: ChatOptions): Promise<string> {
  const base = ENV.AI_BASE_URL.replace(/\/+$/, '');
  const response = await axios.post(
    `${base}/chat/completions`,
    {
      model: ENV.AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: opts.maxTokens ?? 600,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    },
    {
      headers: ENV.AI_API_KEY ? { Authorization: `Bearer ${ENV.AI_API_KEY}` } : {},
      timeout: ENV.AI_TIMEOUT_MS,
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new AiError('empty completion from the AI gateway');
  return String(content);
}

async function geminiChat(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(ENV.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Single chat completion. Throws AiError when no provider is usable.
 */
export async function chat(prompt: string, opts: ChatOptions = {}): Promise<string> {
  if (ENV.AI_PROVIDER === 'none') throw new AiError('AI provider is disabled');
  if (ENV.AI_PROVIDER === 'gemini') {
    if (!ENV.GOOGLE_API_KEY) throw new AiError('GOOGLE_API_KEY is not set');
    return geminiChat(prompt);
  }
  if (!ENV.AI_BASE_URL) throw new AiError('AI_BASE_URL is not set');
  return openAiChat(prompt, opts);
}

/**
 * Chat completion parsed as JSON. Tolerates markdown fences and, as a last
 * resort, a JSON object embedded in prose.
 */
export async function chatJson<T>(prompt: string, maxTokens = 800): Promise<T> {
  const raw = stripFences(await chat(prompt, { json: true, maxTokens }));

  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) throw new AiError('model did not return JSON');
    return JSON.parse(raw.slice(start, end + 1)) as T;
  }
}
