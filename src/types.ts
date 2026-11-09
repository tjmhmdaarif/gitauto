/**
 * Types for the daily automation guide items.
 */
export interface GuideItem {
  id: string;                    // unique identifier (provider + remote id)
  title: string;                 // e.g. "Next.js TypeScript Boilerplate"
  source: string;                // e.g. "GitHub", "AI Skills"
  url: string;                   // link to the repo/guide
  description: string;           // one-sentence description
  setup_steps: string[];         // key setup steps
  ai_summary: string;            // AI-generated summary paragraph
  fetched_at: string;            // ISO timestamp when fetched
  seen: boolean;                 // whether already sent in a digest
  // enrichment fields
  stars?: number;
  topics?: string[];
  language?: string;
  updated_at?: string;
  use_cases?: string;
  applications?: string;
  setup_url?: string;
  verdict?: string;
}

export interface SourceConfig {
  name?: string;
  type: 'github' | 'vercel' | 'ai_skill' | 'custom';
  query: string;                 // search query, repo name, or provider name
  filter?: (item: GuideItem) => boolean; // optional filter function
}

export interface DigestConfig {
  date: string;                  // ISO date string
  guides: GuideItem[];
  total_new: number;             // number of new guides since last digest
}
