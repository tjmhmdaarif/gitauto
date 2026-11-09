/**
 * SQLite-backed storage for tracking fetched guides and sent digests.
 * Uses the native sqlite3 module (v5+).
 */
import sqlite3 from 'sqlite3';
import { GuideItem } from './types.js';

const DB_PATH = process.env.DB_PATH || 'daily_automation.db';

type Row = { [key: string]: any };

export interface Storage {
  init(): Promise<void>;
  markSeen(guide: GuideItem): Promise<void>;
  isSeen(guideId: string): Promise<boolean>;
  getLastDigestDate(): Promise<string | null>;
  setLastDigestDate(date: string): Promise<void>;
  getSentGuideIds(): Promise<string[]>;
  markGuidesSent(date: string, guideIds: string[]): Promise<void>;
  getGuideHistory(date: string): Promise<GuideItem[] | null>;
}

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS guides (
    id TEXT PRIMARY KEY,
    title TEXT,
    source TEXT,
    url TEXT,
    description TEXT,
    ai_summary TEXT,
    fetched_at TEXT,
    seen INTEGER DEFAULT 0,
    stars INTEGER,
    topics TEXT,
    language TEXT,
    updated_at TEXT,
    use_cases TEXT,
    applications TEXT,
    setup_url TEXT,
    verdict TEXT
  );
  CREATE TABLE IF NOT EXISTS digests (
    date TEXT PRIMARY KEY,
    sent_at TEXT,
    guide_ids TEXT
  );
`;

// Columns added after the original scaffold; added lazily so existing DBs keep working.
const MIGRATIONS: Record<string, string> = {
  stars: 'INTEGER',
  topics: 'TEXT',
  language: 'TEXT',
  updated_at: 'TEXT',
  use_cases: 'TEXT',
  applications: 'TEXT',
  setup_url: 'TEXT',
  verdict: 'TEXT',
};

export class SqliteStorage implements Storage {
  private db: sqlite3.Database | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) return reject(err);
        this.db = db;
        db.exec(CREATE_SQL, (execErr) => {
          if (execErr) return reject(execErr);
          this.migrate(db, resolve, reject);
        });
      });
    });
  }

  private migrate(db: sqlite3.Database, resolve: () => void, reject: (e: Error) => void): void {
    db.all('PRAGMA table_info(guides)', (err: Error | null, rows: Row[]) => {
      if (err) return reject(err);
      const existing = new Set((rows || []).map((r) => r.name));
      const missing = Object.entries(MIGRATIONS).filter(([col]) => !existing.has(col));
      if (missing.length === 0) return resolve();

      let pending = missing.length;
      for (const [col, type] of missing) {
        db.run(`ALTER TABLE guides ADD COLUMN ${col} ${type}`, (alterErr: Error | null) => {
          if (alterErr) return reject(alterErr);
          pending -= 1;
          if (pending === 0) resolve();
        });
      }
    });
  }

  async markSeen(guide: GuideItem): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO guides
           (id, title, source, url, description, ai_summary, fetched_at, seen,
            stars, topics, language, updated_at, use_cases, applications, setup_url, verdict)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          guide.id,
          guide.title,
          guide.source,
          guide.url,
          guide.description,
          guide.ai_summary,
          guide.fetched_at,
          guide.stars ?? null,
          (guide.topics || []).join(','),
          guide.language || null,
          guide.updated_at || null,
          guide.use_cases || null,
          guide.applications || null,
          guide.setup_url || null,
          guide.verdict || null,
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async isSeen(guideId: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.db!.get(
        `SELECT seen FROM guides WHERE id = ?`,
        [guideId],
        (err: Error | null, row: Row) => {
          if (err) return reject(err);
          resolve(row?.seen === 1);
        }
      );
    });
  }

  async getLastDigestDate(): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      this.db!.get(
        `SELECT MAX(date) as last_date FROM digests`,
        [],
        (err: Error | null, row: Row) => {
          if (err) return reject(err);
          resolve(row?.last_date || null);
        }
      );
    });
  }

  async setLastDigestDate(date: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO digests (date, sent_at, guide_ids) VALUES (?, datetime('now'), ?)`,
        [date, ''],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async getSentGuideIds(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.db!.all(
        `SELECT guide_ids FROM digests WHERE sent_at IS NOT NULL`,
        [],
        (err: Error | null, rows: Row[]) => {
          if (err) return reject(err);
          const ids: string[] = [];
          for (const row of rows) {
            if (row.guide_ids) {
              ids.push(...row.guide_ids.split(','));
            }
          }
          resolve(ids);
        }
      );
    });
  }

  async markGuidesSent(date: string, guideIds: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db!.run(
        `INSERT OR REPLACE INTO digests (date, sent_at, guide_ids) VALUES (?, datetime('now'), ?)`,
        [date, guideIds.join(',')],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async getGuideHistory(date: string): Promise<GuideItem[] | null> {
    return new Promise<GuideItem[] | null>((resolve, reject) => {
      this.db!.all(
        `SELECT id, title, source, url, description, ai_summary, fetched_at, seen,
                stars, topics, language, updated_at, use_cases, applications, setup_url, verdict
         FROM guides WHERE fetched_at LIKE ?`,
        [`${date}%`],
        (err: Error | null, rows: Row[]) => {
          if (err) return reject(err);
          if (!rows || rows.length === 0) return resolve(null);
          resolve(
            (rows as Row[]).map((r) => ({
              ...r,
              topics: r.topics ? String(r.topics).split(',') : [],
              setup_steps: [] as string[],
              seen: r.seen === 1,
            })) as unknown as GuideItem[]
          );
        }
      );
    });
  }
}
