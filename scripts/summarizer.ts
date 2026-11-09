//
// AI Summarizer: Google Gemini summarization with a local fallback.
// If the Gemini call fails (no key, billing block, network), we still
// produce a useful digest from the guide metadata.
//
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GuideItem } from '../src/types.js';
import { ENV } from '../src/config.js';

const genAI = new GoogleGenerativeAI(ENV.GOOGLE_API_KEY);

function fallbackSummary(guide: GuideItem): string {
  const desc = (guide.description || '').replace(/\s+/g, ' ').trim();
  const steps = (guide.setup_steps || []).filter(Boolean).join(' -> ');
  if (!desc && !steps) return 'No description available.';
  const base = desc.length > 240 ? desc.slice(0, 240).trimEnd() + '...' : desc;
  if (base && steps) return `${base} Suggested setup: ${steps}.`;
  return base || `Suggested setup: ${steps}.`;
}

export async function summarizeGuide(guide: GuideItem): Promise<string> {
  if (!ENV.GOOGLE_API_KEY) {
    return fallbackSummary(guide);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
You are a helpful assistant summarizing a software setup guide.

Given this guide metadata:
- Title: ${guide.title}
- Source: ${guide.source}
- Description: ${guide.description}
- Key setup steps: ${guide.setup_steps.join(', ')}

Write a concise summary (2-3 sentences) highlighting:
1. What this guide/setup is about
2. What the user needs to install/configure
3. One key tip or gotcha

Keep it practical and actionable. Do not include markdown formatting. Return just the summary text.
`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim();
  } catch (err) {
    console.error('Error summarizing guide:', (err as Error).message);
    return fallbackSummary(guide);
  }
}
