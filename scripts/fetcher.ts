//
// Fetcher: pull notable repos/skills from the configured sources.
// GitHub sources are filtered by MIN_STARS and sorted by star count.
//
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { GuideItem, SourceConfig } from '../src/types.js';
import { ENV } from '../src/config.js';

const VERCEL_FEED_URL = 'https://vercel.com/blog/feed';

function stripHtml(input: unknown): string {
  if (!input) return '';
  let text = '';
  if (typeof input === 'string') {
    text = input;
  } else if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    text = String(obj['#text'] ?? obj['@_href'] ?? '');
  }
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function linkHref(link: unknown, fallback: string): string {
  if (!link) return fallback;
  if (typeof link === 'string') return link;
  if (Array.isArray(link)) return linkHref(link[0], fallback);
  const obj = link as Record<string, unknown>;
  return String(obj['@_href'] || obj['href'] || fallback);
}

export class GuideFetcher {
  async fetchFromSource(sourceConfig: SourceConfig, limit: number): Promise<GuideItem[]> {
    const type = sourceConfig.type;

    switch (type) {
      case 'github':
        return this.githubSearch(sourceConfig.query, limit, 'GitHub');
      case 'ai_skill':
        return this.githubSearch(sourceConfig.query, limit, 'AI Skills');
      case 'vercel':
        // The Vercel blog feed carries no star counts, so MIN_STARS cannot be
        // applied here without silently dropping the whole source.
        return this.searchVercel(limit);
      case 'custom':
        return this.customFetch(sourceConfig.query, limit);
      default:
        console.warn(`Unknown source type: ${type}, returning empty.`);
        return [];
    }
  }

  private async githubSearch(
    query: string,
    limit: number,
    sourceLabel: string
  ): Promise<GuideItem[]> {
    const url = 'https://api.github.com/search/repositories';
    const params: Record<string, string | number> = {
      q: `${query} stars:>=${ENV.MIN_STARS}`,
      per_page: Math.min(limit, 30),
      // Sort by stars and the top of the list barely moves, so the daily digest
      // would go empty after the first run. Sorting by "updated" surfaces the
      // notable repos that actually moved since the last digest.
      sort: 'updated',
      order: 'desc',
    };

    const headers: Record<string, string> = {};
    if (ENV.GITHUB_TOKEN) headers.Authorization = `Bearer ${ENV.GITHUB_TOKEN}`;

    try {
      const response = await axios.get(url, { params, timeout: 15000, headers });
      const items = response.data.items || [];
      return items.map((item: any) => ({
        id: `gh-${item.id}`,
        title: item.full_name,
        source: sourceLabel,
        url: item.html_url,
        description: item.description || 'No description available',
        setup_steps: ['Open the repository', 'Follow the README setup', 'Run the project'],
        ai_summary: '',
        fetched_at: new Date().toISOString(),
        seen: false,
        stars: item.stargazers_count,
        topics: item.topics || [],
        language: item.language || '',
        updated_at: item.updated_at || '',
      }));
    } catch (err) {
      console.error(`${sourceLabel} search error:`, (err as Error).message);
      return [];
    }
  }

  private async searchVercel(limit: number): Promise<GuideItem[]> {
    try {
      const response = await axios.get(VERCEL_FEED_URL, { timeout: 15000 });
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseTagValue: false,
        trimValues: true,
      });
      const feed = parser.parse(response.data);
      const entries = feed?.feed?.entry;
      if (!entries) {
        console.warn('Vercel feed returned no entries.');
        return [];
      }
      const list = Array.isArray(entries) ? entries : [entries];
      return list.slice(0, limit).map((entry: any, index: number) => ({
        id: `vercel-${entry.id || index}`,
        title: entry.title || 'Vercel update',
        source: 'Vercel',
        url: linkHref(entry.link, 'https://vercel.com/blog'),
        description: stripHtml(entry.content ?? entry.summary),
        setup_steps: ['Read the changelog', 'Update your Vercel SDK', 'Redeploy'],
        ai_summary: '',
        fetched_at: new Date().toISOString(),
        seen: false,
      }));
    } catch (err) {
      console.error('Vercel feed error:', (err as Error).message);
      return [];
    }
  }

  private customFetch(query: string, limit: number): Promise<GuideItem[]> {
    return Promise.resolve([]);
  }
}
