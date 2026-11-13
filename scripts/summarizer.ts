//
// AI Summarizer: calls the configured AI provider, with a local heuristic
// fallback so a dead gateway, an expired key, or a billing block never costs
// us the digest.
//
import { chat } from '../src/ai.js';
import { GuideItem } from '../src/types.js';

function fallbackSummary(guide: GuideItem): string {
  const desc = (guide.description || '').replace(/\s+/g, ' ').trim();
  const steps = (guide.setup_steps || []).filter(Boolean).join(' -> ');
  if (!desc && !steps) return 'No description available.';
  const base = desc.length > 240 ? desc.slice(0, 240).trimEnd() + '...' : desc;
  if (base && steps) return `${base} Suggested setup: ${steps}.`;
  return base || `Suggested setup: ${steps}.`;
}

export async function summarizeGuide(guide: GuideItem): Promise<string> {
  try {
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
    const text = (await chat(prompt, { maxTokens: 300 })).trim();
    return text || fallbackSummary(guide);
  } catch (err) {
    console.error('Error summarizing guide:', (err as Error).message);
    return fallbackSummary(guide);
  }
}
