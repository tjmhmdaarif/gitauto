//
// Enricher: attach use cases, applications, a setup link, and a verdict.
// Uses the configured AI provider when one is reachable; otherwise derives
// everything from the repository metadata returned by the GitHub API.
//
import { chatJson } from '../src/ai.js';
import { GuideItem } from '../src/types.js';

function starTier(stars: number): string {
  if (stars >= 200000) return 'Exceptional';
  if (stars >= 100000) return 'Strong pick';
  if (stars >= 50000) return 'Notable';
  if (stars >= 30000) return 'Solid';
  return 'Watch list';
}

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function heuristicVerdict(guide: GuideItem): string {
  const stars = guide.stars ?? 0;
  const days = daysSince(guide.updated_at || '');
  const parts = [`${starTier(stars)} \u2014 ${stars.toLocaleString()} stars`];
  if (guide.language) parts.push(`primary language ${guide.language}`);
  if (days !== null) {
    parts.push(days <= 30 ? 'actively maintained' : days <= 180 ? 'maintained' : 'stale');
  }
  return parts.join(', ') + '.';
}

function heuristicUseCases(guide: GuideItem): string {
  const desc = (guide.description || '').replace(/\s+/g, ' ').trim();
  const topics = (guide.topics || []).slice(0, 6);
  if (desc && topics.length) return `${desc} Topics: ${topics.join(', ')}.`;
  if (desc) return desc;
  if (topics.length) return `Topics: ${topics.join(', ')}.`;
  return 'See the repository README for use cases.';
}

function heuristicApplications(guide: GuideItem): string {
  const hay = `${(guide.topics || []).join(' ')} ${guide.description || ''}`.toLowerCase();
  const apps: string[] = [];
  if (/agent|skill/.test(hay)) apps.push('AI agent and skill development');
  if (/rag|retrieval|embed|vector/.test(hay)) apps.push('RAG and knowledge retrieval');
  if (/chat|llm|language|prompt/.test(hay)) apps.push('LLM application development');
  if (/workflow|automat|pipeline/.test(hay)) apps.push('workflow automation');
  if (/deploy|infra|serverless|platform/.test(hay)) apps.push('deployment and infrastructure');
  if (apps.length === 0) apps.push('AI/LLM tooling evaluation and prototyping');
  return `${apps.slice(0, 3).join('; ')}.`;
}

interface Enrichment {
  use_cases?: string;
  applications?: string;
  verdict?: string;
}

export async function enrichGuide(guide: GuideItem): Promise<GuideItem> {
  guide.setup_url = guide.url;

  try {
    const prompt = `You are analysing a GitHub repository for a daily digest of notable AI agent skills and tools.

Repository: ${guide.title}
Stars: ${guide.stars ?? 'unknown'}
Primary language: ${guide.language || 'unknown'}
Topics: ${(guide.topics || []).join(', ') || 'none'}
Description: ${guide.description}

Respond with ONLY a JSON object (no markdown fences) with exactly these keys:
- "use_cases": what this repository/skill is used for, as 2-3 short points separated by " | "
- "applications": 1-2 sentences on where it is applied in practice
- "verdict": a short verdict starting with one of Exceptional / Strong pick / Notable / Niche / Skip, then one concrete reason grounded in the stars and description

JSON:`;
    const parsed = await chatJson<Enrichment>(prompt);
    guide.use_cases = parsed.use_cases || heuristicUseCases(guide);
    guide.applications = parsed.applications || heuristicApplications(guide);
    guide.verdict = parsed.verdict || heuristicVerdict(guide);
  } catch (err) {
    console.error(`Enrichment failed for ${guide.title}:`, (err as Error).message);
    guide.use_cases = heuristicUseCases(guide);
    guide.applications = heuristicApplications(guide);
    guide.verdict = heuristicVerdict(guide);
  }

  return guide;
}
