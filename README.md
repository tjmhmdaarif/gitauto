<div align="center">

# 🤖 GITAUTO

### _You don't have time to watch GitHub. GITAUTO does._

**A bot that scouts the most notable AI repositories and skills every night,
enriches them with use cases, applications, a setup link and a verdict — then
delivers one curated digest to your webhook, your inbox, and your phone.**

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
   "ai agent"          "skills"            (always included)
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │  FILTER         │  stars >= MIN_STARS
                    │                 │  sort: updated desc
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  DEDUPE         │  against SQLite `guides`
                    │                 │  collapse cross-source dupes
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  ENRICH         │  AI provider (OpenAI-compatible
                    │                 │  or Gemini) with metadata fallback
                    │                 │  use cases · applications
                    │                 │  setup link · verdict
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  PERSIST        │  SQLite `daily_automation.db`
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  DELIVER        │  webhook ─┐
                    │                 │  email    ─┼─► all, independently
                    │                 │  ntfy     ─┘
                    └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  SCHEDULE       │  GitHub Actions `daily.yml`
                    │                 │  daily 00:00 UTC — runs in the
                    │                 │  cloud, no PC required
                    └─────────────────┘
```

---

## 🎯 What gets picked

| Source | Query | Filter |
|---|---|---|
| `github` | `ai agent` | `stars:>=MIN_STARS` |
| `ai_skills` | `skills` | `stars:>=MIN_STARS` |
| `vercel` | Atom feed | none (feed carries no star counts) |

Results are sorted by **last update, descending**, so the digest reflects what
actually moved since the previous run instead of replaying the same static top
of the star chart. Deduplication is by repository ID — a repository appears in
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

When an AI provider is configured, the verdict, use cases and applications are
**AI-generated**; otherwise they are derived from the repository's own metadata
(description, topics, language, push recency).

---

## ⚙️ Configuration

```bash
BOT_NAME=GITAUTO                  # bot identity in headers, subject, logs

# AI provider — 'openai' (any OpenAI-compatible endpoint), 'gemini', or 'none'
AI_PROVIDER=openai
AI_BASE_URL=http://127.0.0.1:3001/v1
AI_API_KEY=your_key
AI_MODEL=auto/best-fast
GOOGLE_API_KEY=                   # only used when AI_PROVIDER=gemini

WEBHOOK_URL=your_webhook_url      # Discord / Slack / any catcher
EMAIL_USER=you@gmail.com          # digest recipient
EMAIL_PASS=your_gmail_app_pass    # app password, not your real password
NTFY_TOPIC=                       # optional ntfy.sh topic for push delivery

GITHUB_TOKEN=                     # raises the GitHub search rate limit

SOURCES=github,vercel,ai_skills
FETCH_LIMIT=20
MIN_STARS=30000
MAX_DIGEST=12
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

### Run it in the cloud (recommended)

The digest is scheduled by [GitHub Actions](.github/workflows/daily.yml) at
**00:00 UTC every day**. It runs on GitHub's runners, so it delivers even when
your PC is off or asleep. The dedupe database is committed back to the repo
after every run, so each day only surfaces what is genuinely new.

Add these repository secrets (`Settings → Secrets and variables → Actions`):

| Secret | Meaning |
|---|---|
| `AI_API_KEY` | key for the OpenAI-compatible endpoint |
| `WEBHOOK_URL` | webhook catcher URL |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail address + app password |
| `NTFY_TOPIC` | optional ntfy.sh topic for push delivery |

The workflow uses `AI_BASE_URL=https://integrate.api.nvidia.com/v1` and
`AI_MODEL=mistralai/mistral-large-4-1t-a52b`; edit `daily.yml` to point at any
other OpenAI-compatible provider.

### Run it locally

```powershell
powershell -ExecutionPolicy Bypass -File deploy/register-task.ps1
schtasks /run /tn GITAUTO
```

The local task is a fallback for when you want to run it on your own machine.
`deploy/ensure-gateway.mjs` makes sure the local AI gateway is up first, and
the task is configured to survive battery and idle conditions.

---

## 🗂 Project structure

```
gitauto/
├── .github/workflows/
│   └── daily.yml           # cloud schedule — daily 00:00 UTC, commits state
├── scripts/
│   ├── scheduler.ts        # entry point — cron loop or one-shot
│   ├── main.ts             # pipeline orchestration + digest builder
│   ├── fetcher.ts          # GitHub + Vercel sources, star filter
│   ├── summarizer.ts       # optional AI summary helper (not part of the digest)
│   ├── enricher.ts         # use cases, applications, setup, verdict
│   └── saver.ts            # persistence helper
├── src/
│   ├── ai.ts               # OpenAI-compatible + Gemini client
│   ├── config.ts           # env config + source definitions
│   ├── types.ts            # GuideItem and friends
│   └── storage.ts          # SQLite history + lazy migrations
├── deploy/
│   ├── run-daily.bat       # task wrapper (TZ=UTC, logs to logs/daily.log)
│   ├── ensure-gateway.mjs  # starts the local AI gateway if it is down
│   └── register-task.ps1   # registers the GITAUTO scheduled task
├── docs/
│   └── WORKFLOW.md         # the pipeline, stage by stage
├── .env.example            # copy to .env
└── daily_automation.db     # dedupe state (committed; shared with CI)
```

---

## 📅 The daily rhythm

```
00:00 UTC  ──►  GitHub Actions starts the run (PC not required)
00:00 UTC  ──►  fetch candidates from GitHub + Vercel
00:01 UTC  ──►  filter, dedupe, enrich
00:02 UTC  ──►  persist to SQLite
00:02 UTC  ──►  deliver to webhook + email + ntfy
00:03 UTC  ──►  commit the updated state DB back to the repo
```

All timestamps in the digest use the **UTC date**. The local wrapper sets
`TZ=UTC` before launching Node for the same reason.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
