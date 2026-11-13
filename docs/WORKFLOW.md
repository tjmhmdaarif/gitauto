# GITAUTO — Workflow

This document explains the pipeline stage by stage: what runs, in what order,
what data moves where, and what happens when something fails.

---

## Entry points

GITAUTO has two modes, both in `scripts/scheduler.ts`:

| Mode | Command | Behaviour |
|---|---|---|
| **One-shot** | `node dist/scripts/scheduler.js --run-now` | Runs the pipeline once, exits. Used by GitHub Actions and by the local Windows task. |
| **On-demand** | `npm run schedule -- --trigger` | Same as one-shot, via `tsx`. |
| **Cron loop** | `node dist/scripts/scheduler.js` | Stays alive and runs on `CRON_SCHEDULE`. |

The primary schedule is the [GitHub Actions workflow](../.github/workflows/daily.yml),
which fires the one-shot mode daily at **00:00 UTC** on GitHub's runners — so the
digest is delivered even when the PC is off. After each run it commits the
updated `daily_automation.db` back to the repo, which is what makes the dedupe
state survive between runs.

The local Windows task `GITAUTO` is a fallback for running on your own machine.
`deploy/run-daily.bat` wraps the same one-shot mode, and
`deploy/ensure-gateway.mjs` makes sure the local AI gateway is up first.

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
| `github` | `githubSearch()` | `q = "<query> stars:>=MIN_STARS"`, `sort=updated`, `order=desc` |
| `ai_skill` | `githubSearch()` | same mechanism, different query |
| `vercel` | `searchVercel()` | Atom feed; always included (carries no star counts) |
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

One pass, `enrichGuide()`, produces four fields:

| Field | Source |
|---|---|
| `use_cases` | AI, falling back to description + GitHub topics |
| `applications` | AI, falling back to topic keyword matching |
| `setup_url` | repository URL |
| `verdict` | AI, falling back to star tier + language + maintenance |

The call goes through `src/ai.ts`, which speaks to any OpenAI-compatible
endpoint (`AI_PROVIDER=openai`, the default — the cloud workflow uses NVIDIA
NIM) or to Gemini (`AI_PROVIDER=gemini`). Calls are retried with backoff and a
minimum gap between requests, because free tiers rate-limit bursts. If no
provider is configured, every field is derived locally. **The digest is never
blocked by the AI.**

`scripts/summarizer.ts` is an optional helper that is not part of the digest and
is not called by the pipeline.

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

NTFY_TOPIC set?    ── yes ──► POST https://ntfy.sh/<topic> (push)
                   └─ no  ──► skip
```

A working webhook no longer suppresses email — every channel fires
independently. If no channel works, the run warns loudly rather than silently
succeeding.

---

## Failure behaviour

| Failure | Behaviour |
|---|---|
| GitHub API error | logs, returns `[]` — other sources continue |
| AI provider error | retries with backoff, then falls back to metadata — digest still sent |
| Webhook error | logs, other channels still attempted |
| Email error | logs, run continues |
| ntfy error | logs, run continues |
| SQLite error | rejects — run fails loudly |

In the cloud, every step is captured in the Actions run log. Locally, the
Windows task captures everything in `logs/daily.log` and records the exit code,
so `schtasks /query /tn GITAUTO` shows the last result.

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

A typical run with `FETCH_LIMIT=20` and `MAX_DIGEST=12` completes in **2–3
minutes** end to end, including `npm ci` and the build. The enrichment stage is
the slowest part: one AI request per guide, with a minimum gap and retries when
the provider rate-limits.
