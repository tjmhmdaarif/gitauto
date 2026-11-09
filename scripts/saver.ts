//
// Setup guide fetcher: GitHub search
//
import axios from 'axios';
import { GuideItem } from '../src/types.js';
import { ENV, SOURCES_CONFIG } from '../src/config.js';

export class GuideFetcher {
  async searchGitHub(query: string, limit: number): Promise<GuideItem[]> {
    const url = 'https://api.github.com/search/repositories';
    const params = {
      q: `${query} language:readme created:>2024-01-01`,
      per_page: limit,
      sort: 'updated',
      order: 'desc',
    };

    try {
      const response = await axios.get(url, { params });
      const items = response.data.items;
      return items.map((item: any) => this.mapGitHubRepoToGuide(item));
    } catch (err) {
      console.error('Error fetching from GitHub:', err);
      return [];
    }
  }

  private mapGitHubRepoToGuide(item: any): GuideItem {
    const id = item.id.toString();
    const readme = item.description || '';
    const steps = this.extractSetupSteps(readme, 3);

    return {
      id,
      title: item.name,
      source: 'GitHub',
      url: item.html_url,
      description: readme.substring(0, 150) + (readme.length > 150 ? '...' : ''),
      setup_steps: steps,
      ai_summary: '', // Will be filled by the summarizer
      fetched_at: new Date().toISOString(),
      seen: false,
    };
  }

  private extractSetupSteps(description: string, count: number): string[] {
    const steps = [
      'Check system requirements',
      'Install dependencies',
      'Run setup script',
      'Configure project',
      'Test the setup',
    ];
    return steps.slice(0, count);
  }
}