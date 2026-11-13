//
// Main orchestrator: runs the full daily automation pipeline
//
import 'dotenv/config';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { GuideFetcher } from './fetcher.js';
import { summarizeGuide } from './summarizer.js';
import { enrichGuide } from './enricher.js';
import { SqliteStorage } from '../src/storage.js';
import { GuideItem } from '../src/types.js';
import { ENV, SOURCES_CONFIG } from '../src/config.js';

interface PipelineResult {
  date: string;
  newGuides: GuideItem[];
  sentGuides: GuideItem[];
  digestText: string;
}

export async function runPipeline(trigger: boolean = false): Promise<PipelineResult> {
  const date = new Date().toISOString().split('T')[0];
  const storage = new SqliteStorage();
  await storage.init();

  // If not triggered and we already sent a digest today, skip
  if (!trigger) {
    const lastDate = await storage.getLastDigestDate();
    if (lastDate === date) {
      console.log('✅ Digest already sent today, skipping.');
      return { date, newGuides: [], sentGuides: [], digestText: '' };
    }
  }

  console.log(`📅 Running daily automation for ${date}`);

  // 1. Fetch guides from configured sources
  const fetcher = new GuideFetcher();
  const allGuides: GuideItem[] = [];

  for (const sourceName of ENV.SOURCES) {
    const sourceConfig = SOURCES_CONFIG[sourceName as keyof typeof SOURCES_CONFIG];
    if (!sourceConfig) {
      console.warn(`⚠️ Unknown source: ${sourceName}, skipping.`);
      continue;
    }

    console.log(`🔍 Fetching from source: ${sourceName} (query: "${sourceConfig.query}")`);
    const fetched = await fetcher.fetchFromSource(sourceConfig, ENV.FETCH_LIMIT);
    allGuides.push(...fetched);
  }

  console.log(`📦 Fetched ${allGuides.length} total guides.`);

  // 2. Deduplicate: skip guides already in the DB and collapse cross-source duplicates
  const newGuides: GuideItem[] = [];
  const dedupeIds = new Set<string>();
  for (const guide of allGuides) {
    if (dedupeIds.has(guide.id)) continue;
    const alreadySeen = await storage.isSeen(guide.id);
    if (!alreadySeen) {
      newGuides.push(guide);
      dedupeIds.add(guide.id);
    }
  }

  console.log(`🆕 ${newGuides.length} new guides found.`);

  // 3. Summarize each new guide (falls back to metadata if Gemini is unavailable)
  for (const guide of newGuides) {
    guide.ai_summary = await summarizeGuide(guide);
  }

  // 4. Enrich with use cases, applications, setup link, and a verdict
  for (const guide of newGuides) {
    await enrichGuide(guide);
  }

  // Persist the enriched guides so history survives restarts
  for (const guide of newGuides) {
    await storage.markSeen(guide);
  }

  // 5. Build the digest text
  const newGuideIds: string[] = [];
  const digestParts: string[] = [];
  const starLabel = (n?: number) => {
    if (!n) return '';
    return n >= 1000 ? ` ★ ${(n / 1000).toFixed(1)}k` : ` ★ ${n}`;
  };

  for (const guide of newGuides) {
    newGuideIds.push(guide.id);
    digestParts.push(
      `## ${guide.title}${starLabel(guide.stars)}
` +
        `**Source:** ${guide.source}
` +
        `**Use cases:** ${guide.use_cases || 'See repository.'}
` +
        `**Applications:** ${guide.applications || 'See repository.'}
` +
        `**Setup:** ${guide.setup_url || guide.url}
` +
        `**Verdict:** ${guide.verdict || 'n/a'}

---

`
    );
  }

  const digestText =
    `# ${ENV.BOT_NAME} — Today's Software Setup Guides - ${date}\n\n` +
    `Found ${newGuides.length} new setup guides:\n\n` +
    `${digestParts.join('\n')}\n` +
    `*Automated daily digest. To configure email/webhook delivery, set ENV variables.*\n\n`;

  // 6. Mark guides as sent in DB
  await storage.markGuidesSent(date, newGuideIds);

  // 7. Send the digest (via webhook/email if configured)
  if (!ENV.DRY_RUN && (ENV.WEBHOOK_URL || ENV.EMAIL_USER)) {
    await sendDigest(digestText);
  } else if (ENV.DRY_RUN) {
    console.log('🔇 DRY_RUN mode: digest not sent (would send via webhook/email).');
    console.log('---DIGEST STARTS HERE---');
    console.log(digestText);
    console.log('---DIGEST ENDS HERE---');
  }

  return {
    date,
    newGuides,
    sentGuides: newGuides, // guides included in this digest
    digestText,
  };
}

async function sendDigest(digestText: string): Promise<void> {
  // Deliver on every configured channel. Webhook and email are independent:
  // a working webhook must not suppress the email digest.
  const delivered: string[] = [];

  if (ENV.WEBHOOK_URL) {
    try {
      await axios.post(ENV.WEBHOOK_URL, { content: digestText });
      console.log('📤 Sent digest via webhook.');
      delivered.push('webhook');
    } catch (err) {
      console.error('❌ Failed to send webhook:', (err as Error).message);
    }
  } else {
    console.warn('⚠️ WEBHOOK_URL not set - skipping webhook.');
  }

  if (ENV.EMAIL_USER && ENV.EMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: ENV.EMAIL_USER,
          pass: ENV.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${ENV.BOT_NAME}" <${ENV.EMAIL_USER}>`,
        to: ENV.EMAIL_USER,
        subject: `${ENV.BOT_NAME} — Today's Software Setup Guides - ${new Date().toISOString().split('T')[0]}`,
        text: digestText,
      });

      console.log('📧 Sent digest via email.');
      delivered.push('email');
    } catch (err) {
      console.error('❌ Failed to send email:', (err as Error).message);
    }
  } else {
    console.warn('⚠️ EMAIL_PASS not set - skipping email.');
  }

  if (ENV.NTFY_TOPIC) {
    try {
      await axios.post(`https://ntfy.sh/${ENV.NTFY_TOPIC}`, digestText, {
        headers: {
          Title: `${ENV.BOT_NAME} — ${new Date().toISOString().split('T')[0]}`,
          Tags: 'envelope',
        },
        timeout: 15000,
      });
      console.log('🔔 Sent digest via ntfy.');
      delivered.push('ntfy');
    } catch (err) {
      console.error('❌ Failed to send ntfy:', (err as Error).message);
    }
  }

  if (delivered.length === 0) {
    console.warn('⚠️ Digest not delivered: no working channel configured.');
  }
}
