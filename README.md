<div align="center">

# 🤖 GITAUTO

### _You don't have time to watch GitHub. GITAUTO does._

**A bot that scouts the most notable AI repositories and skills every night,
enriches them with use cases, applications, a setup link and a verdict — then
delivers one curated digest to your webhook and your inbox.**

`fetch` → `filter` → `enrich` → `dedupe` → `deliver`

<br>

</div>

---

## ✨ What it does

- 🔭 **Scouts** GitHub every night at **00:00 UTC** for AI agent repositories and skills
- ⭐ **Filters** to only the heavyweights — `MIN_STARS` (default **30,000**)
- 🧠 **Enriches** every entry with use cases, applications, a setup link and a verdict
- 📬 **Delivers** one combined digest to your **webhook _and_ email**
- 🧹 **Deduplicates** by repository ID, so you never see the same repo twice

---

## 📬 A digest looks like this

```
## morluto/rea ★ 446.1k
**Source:** GitHub
**Use cases:** Reverse engineer anything with agents, from app behavior down to
                native binaries. Topics: agent-skills, ai, android, claude-code.
**Applications:** AI agent and skill development.
**Setup:** https://github.com/morluto/rea
**Verdict:** Exceptional — 446,124 stars, primary language TypeScript, actively maintained.
```

Every entry answers four questions at a glance: **what is it for**, **where is it
used**, **how do I start**, and **should I care**.

---

## 🔩 How it works

```
   ┌──────────────────────────────────────────────────────────────┐
   │                     GITAUTO PIPELINE                         │
   └──────────────────────────────────────────────────────────────┘

   [ GitHub Search ]   [ GitHub Search ]   [ Vercel Atom feed ]
   "ai agent"          "skills"            (skipped by MIN_STARS)
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │  FILTER         │  stars >= MIN_STARS
                    │                 │  sort: stars desc
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  DEDUPE         │  against SQLite `guides`
                    │                 │  collapse cross-source dupes
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  ENRICH         │  Gemini (or metadata fallback)
                    │                 │  use cases · applications
                    │                 │  setup link · verdict
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  PERSIST        │  SQLite `daily_automation.db`
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  DELIVER        │  webhook  ─┐
                    │                 │  email    ─┴─► both, independently
                    └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  SCHEDULE       │  Windows task `GITAUTO`
                    │                 │  daily 00:00 UTC
                    └─────────────────┘
```

---

## 🎯 What gets picked

| Source | Query | Filter |
|---|---|---|
| `github` | `ai agent` | `stars:>=MIN_STARS` |
| `ai_skills` | `skills` | `stars:>=MIN_STARS` |
| `vercel` | Atom feed | skipped when `MIN_STARS > 0` (no star data) |

Results are sorted by **stars descending**, so the most notable repositories
surface first. Deduplication is by repository ID — a repository appears in
**exactly one digest, ever**.

> 💡 **Why no `setup guide` query?** At a 30k-star threshold the phrase
> "setup guide" matches *nothing*. The queries were chosen to actually return
> notable AI repositories and skills.

---

## 🧠 The verdict, explained

The verdict is a tier plus evidence:

| Tier | Stars | Meaning |
|---|---|---|
| **Exceptional** | ≥ 200k | Best-in-class, widely adopted |
| **Strong pick** | ≥ 100k | Proven, high traction |
| **Notable** | ≥ 50k | Significant, worth watching |
| **Solid** | ≥ 30k | Meets the bar, worth a look |

…plus the primary language and maintenance status (`actively maintained` ≤ 30
days, `maintained` ≤ 180 days, `stale` beyond).

When a Gemini API key is configured, the verdict, use cases and applications are
**AI-generated**; otherwise they are derived from the repository's own metadata
(description, topics, language, push recency).

---

## ⚙️ Configuration

```bash
BOT_NAME=GITAUTO                  # bot identity in headers, subject, logs
GOOGLE_API_KEY=your_gemini_key    # optional — enables AI enrichment
WEBHOOK_URL=your_webhook_url      # Discord / Slack / any catcher
EMAIL_USER=you@gmail.com          # digest recipient
EMAIL_PASS=your_gmail_app_pass    # app password, not your real password
SOURCES=github,vercel,ai_skills
FETCH_LIMIT=20
MIN_STARS=30000
DRY_RUN=false
CRON_SCHEDULE=0 0 * * *
```

> 🔐 `.env` is gitignored. Never commit it.

---

## 🚀 Quick start

```bash
npm install
cp .env.example .env      # fill in your values
npm run build
npm run schedule -- --trigger   # run once, right now
```

Then register the Windows task:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/register-task.ps1
schtasks /run /tn GITAUTO
```

---

## 🗂 Project structure

```
gitauto/
├── scripts/
│   ├── scheduler.ts        # entry point — cron loop or one-shot
│   ├── main.ts             # pipeline orchestration + digest builder
│   ├── fetcher.ts          # GitHub + Vercel sources, star filter
│   ├── summarizer.ts       # Gemini summary with metadata fallback
│   ├── enricher.ts         # use cases, applications, setup, verdict
│   └── saver.ts            # persistence helper
├── src/
│   ├── config.ts           # env config + source definitions
│   ├── types.ts            # GuideItem and friends
│   └── storage.ts          # SQLite history + lazy migrations
├── deploy/
│   ├── run-daily.bat       # task wrapper (TZ=UTC, logs to logs/daily.log)
│   └── register-task.ps1   # registers the GITAUTO scheduled task
├── docs/
│   └── WORKFLOW.md         # the pipeline, stage by stage
├── .env.example            # copy to .env
└── daily_automation.db     # created at runtime (gitignored)
```

---

## 📅 The daily rhythm

```
00:00 UTC  ──►  GITAUTO wakes up
00:00 UTC  ──►  fetch candidates from GitHub
00:01 UTC  ──►  filter, dedupe, enrich
00:02 UTC  ──►  persist to SQLite
00:02 UTC  ──►  deliver to webhook + email
00:03 UTC  ──►  done. See you tomorrow.
```

All timestamps in the digest use the **UTC date**, which is why the Windows
wrapper sets `TZ=UTC` before launching Node.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
