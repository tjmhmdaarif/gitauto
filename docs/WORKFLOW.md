# GITAUTO — Workflow

This document explains the pipeline stage by stage: what runs, in what order,
what data moves where, and what happens when something fails.

---

## Entry points

GITAUTO has two modes, both in `scripts/scheduler.ts`:

| Mode | Command | Behaviour |
|---|---|---|
| **One-shot** | `node dist/scripts/scheduler.js --run-now` | Runs the pipeline once, exits. Used by the Windows task. |
| **On-demand** | `npm run schedule -- --trigger` | Same as one-shot, via `tsx`. |
| **Cron loop** | `node dist/scripts/scheduler.js` | Stays alive and runs on `CRON_SCHEDULE`. |

The Windows scheduled task `GITAUTO` fires the one-shot mode daily at 05:30
local time (= 00:00 UTC) by running `deploy/run-daily.bat`.

---

## Stage 1 — Guard

`runPipeline()` in `scripts/main.ts`:

```ts
const date = new Date().toISOString().split('T')[0];   // UTC date
if (!trigger && (await storage.getLastDigestDate()) === date) {
  return; // already sent today
}
```

A normal scheduled run will **not** send a second digest on the same UTC day.
`--trigger` bypasses this guard, which is how you test on demand.

---

## Stage 2 — Fetch

`GuideFetcher.fetchFromSource()` dispatches on the source type:

| Type | Handler | Notes |
|---|---|---|
| `github` | `githubSearch()` | `q = "<query> stars:>=MIN_STARS"`, `sort=stars`, `order=desc` |
| `ai_skill` | `githubSearch()` | same mechanism, different query |
| `vercel` | `searchVercel()` | Atom feed; **skipped** when `MIN_STARS > 0` |
| `custom` | `customFetch()` | returns `[]` — hook for future sources |

The GitHub handler captures `stargazers_count`, `topics`, `language` and
`updated_at` in addition to the basic fields. These feed the enrichment stage.

---

## Stage 3 — Deduplicate

Two layers:

1. **Already seen** — `storage.isSeen(id)` checks the SQLite `guides` table.
2. **Cross-source duplicates** — a `Set` of IDs collapses repositories that
   appear in more than one source (e.g. a repo matching both `ai agent` and
   `skills`).

Only guides passing both checks reach the digest.

---

## Stage 4 — Enrich

Two independent passes:

**`summarizeGuide()`** — tries Gemini for a 2–3 sentence summary. On any failure
it falls back to a metadata summary built from the description and setup steps.

**`enrichGuide()`** — produces four fields:

| Field | Source |
|---|---|
| `use_cases` | description + GitHub topics (AI: Gemini) |
| `applications` | topic keyword matching (AI: Gemini) |
| `setup_url` | repository URL |
| `verdict` | star tier + language + maintenance (AI: Gemini) |

If `GOOGLE_API_KEY` is missing or the API rejects the call, every field is
derived locally. **The digest is never blocked by the AI.**

---

## Stage 5 — Persist

`storage.markSeen(guide)` writes the full enriched record with
`INSERT OR REPLACE`, keyed on `id`. Because enrichment happens *before*
persistence, the SQLite history contains the final enriched data.

`storage.markGuidesSent(date, ids)` records which guides went out in which
digest, so the history is reconstructable.

---

## Stage 6 — Deliver

`sendDigest()` delivers on **every configured channel, independently**:

```
WEBHOOK_URL set?  ── yes ──► POST { content: digest }
                  └─ no  ──► warn, continue

EMAIL_USER && EMAIL_PASS? ── yes ──► SMTP via smtp.gmail.com:587
                            └─ no  ──► warn, continue
```

A working webhook no longer suppresses email — both fire. If neither channel
works, the run warns loudly rather than silently succeeding.

---

## Failure behaviour

| Failure | Behaviour |
|---|---|
| GitHub API error | logs, returns `[]` — other sources continue |
| Gemini error | logs, falls back to metadata — digest still sent |
| Webhook error | logs, email still attempted |
| Email error | logs, run continues |
| SQLite error | rejects — run fails loudly |

The Windows task captures everything in `logs/daily.log` and records the exit
code, so `schtasks /query /tn GITAUTO` shows the last result.

---

## Data model

```sql
CREATE TABLE guides (
  id TEXT PRIMARY KEY,
  title TEXT, source TEXT, url TEXT, description TEXT,
  ai_summary TEXT, fetched_at TEXT, seen INTEGER DEFAULT 0,
  stars INTEGER, topics TEXT, language TEXT, updated_at TEXT,
  use_cases TEXT, applications TEXT, setup_url TEXT, verdict TEXT
);

CREATE TABLE digests (
  date TEXT PRIMARY KEY, sent_at TEXT, guide_ids TEXT
);
```

The schema is created on first run and **migrated lazily** — columns added
after the original scaffold are appended with `ALTER TABLE` if missing, so an
existing database keeps working across upgrades.

---

## Timing

A typical run with `FETCH_LIMIT=20` completes in **under 30 seconds**. The
enrichment stage is the slowest part when Gemini is enabled, because each guide
is a separate request.
