# Devpost submission draft — Codegeist 2026: Context Triage

> Status: DRAFT. Fill in the installation link + video URL after the
> browser steps in README.md. Do not submit before the app is deployed and
> tested on the developer site.

## Project name

Context Triage

## Category

Apps for Software Teams

## Bonus prizes selected

- Best Agents — Rovo/Assignable agents
- Best app with Atlassian MCP

## Short description (Devpost "About" field)

Context Triage puts the context developers actually need inside the Jira
issue itself. Open any issue and the panel shows its linked work, recent
activity, a Decision Ledger (decisions from comments and Done transitions,
each linked to its source, with a stale-context warning), a Handoff
Readiness Score (0–100 with verdict and blocker risk), a suggested handoff
draft, a suggested next step, and a suggested assignee — with the reasons
behind every suggestion. A Rovo agent, Triage Assistant, answers
work-status questions from the same live data
("What is the status of PROJ-123?", "Which issues have gone stale?"), and
the same capabilities are exposed as MCP tools for custom agents.

## Long description

Triage is where software teams lose time: a developer opens an issue and has
to reconstruct its story from scattered tabs — linked issues, comment
threads, status history, and a guess about who should pick it up next.
Context Triage removes that hunt.

**Issue panel.** A Forge `jira:issuePanel` renders natively inside the Jira
issue view. For the open issue it shows:

- Linked issues with their status and assignee, so blockers are visible
  at a glance (at most 5 linked issues are shown, to keep the panel cheap).
- Recent activity — the latest comments and status changes.
- **Decision Ledger** — decisions mentioned in comments (last 10 comments,
  expanded matcher including Indonesian phrasing) plus a changelog entry
  each time the status changed to Done, so the "what did we agree?"
  question has an answer without re-reading the thread. Every entry links
  to its source comment, and a warning appears when the last decision is
  over 30 days old.
- **Handoff Readiness Score (0–100)** — five transparent components
  (owner assigned, no open blockers, recently active, decisions recorded,
  linked work resolved) with a verdict (Ready / Almost ready / Not ready)
  and a Blocker Risk, so a handover decision takes one glance.
- **Handoff draft** — a suggested handoff comment as plain text, ready to
  copy into Jira yourself. The app is read-only and never posts comments.
- A suggested next step, chosen by transparent rules: unblock first, then
  assign an owner, then chase stale work, then follow up linked issues.
- A suggested assignee, ranked by recent participation in the issue,
  ownership of open linked work, and current open workload — with the
  reasons displayed next to the name.

**Rovo agent.** Triage Assistant is a `rovo:agent` with three read-only
actions (`get-issue-context`, `find-stalled-issues`, `suggest-assignee`).
It answers status questions in Rovo Chat, grounded in live Jira data, and
never invents issue data. All actions are GET-only: the agent can never
assign, edit, or comment — suggestions stay advisory.

**MCP.** A `rovo:mcp` module exposes the same three actions as MCP tools
for custom agents in Rovo Studio and MCP-compatible clients, and the repo
ships an open-source `skills/triage-context/SKILL.md` any agent can adopt.

**Privacy and cost.** The app runs entirely on Forge, reads Jira only as the
viewing user (`asUser`), and calls no external service — no paid APIs, no
Forge LLM, no data leaves the Atlassian Cloud. Suggestions are deterministic
heuristics over data already in Jira, so every recommendation can be
explained.

## How it meets the technology requirements

- Built on **Atlassian Forge** (`manifest.yml`, runtime `nodejs24.x`) and
  integrated with **Jira** via the Jira Cloud REST API
  (`@forge/api`, scopes `read:jira-work`, `read:jira-user`, `search:jira`).
- Includes a **`rovo:agent`** module (Triage Assistant) with three reusable
  **`action`** modules, qualifying for **Best Agents — Rovo/Assignable
  agents**.
- Includes a **`rovo:mcp`** module exposing those actions as MCP tools,
  qualifying for **Best app with Atlassian MCP**.
- New project created during the hackathon submission period, with a Forge
  manifest and five Forge module types.

## Testing instructions (for judges)

1. Open the installation link below and install the app on your Jira site.
2. Open any Jira issue that has linked issues and a few comments (or create
   a test issue, link another issue to it, and add a comment containing
   "We decided to …").
3. Click the **Context Triage** panel button on the issue: linked issues,
   recent activity, Decision Ledger (click a "View source" link to jump to
   the comment), Handoff Readiness Score with verdict and blocker risk,
   handoff draft, suggested next step, and suggested assignee should
   appear. If the last recorded decision is over 30 days old, a
   "Stale context" warning is shown.
4. In Rovo Chat, open **Triage Assistant** and ask:
   "What is the status of <ISSUE-KEY>?" and
   "Which issues in <PROJECT-KEY> have gone stale?"
5. In Rovo Studio, confirm the **Context Triage MCP** server lists three
   tools: `get-issue-context`, `find-stalled-issues`, `suggest-assignee`.
6. No configuration is needed and no account beyond your Atlassian site is
   required. Everything is read-only.

## Links

- **Installation / Jira site (app installed here, dev env, v2.0.0, status Up-to-date):** https://context-triage-dev.atlassian.net/
- **Developer console overview (app id `ari:cloud:ecosystem::app/c56add27-5527-4f0b-882a-01b86c199e1a`):** https://developer.atlassian.com/console/myapps/c56add27-5527-4f0b-882a-01b86c199e1a/overview
- **Installations in the console:** https://developer.atlassian.com/console/myapps/c56add27-5527-4f0b-882a-01b86c199e1a/monitoring/installations
- **Demo video (<5 min, YouTube):** _TODO — upload `demo-video/context-triage-demo.mp4` (57 detik, 1920×1080, sudah ada di disk) ke YouTube, lalu isi URL-nya di sini_
- **Source code:** https://github.com/Arif201501/context-triage

> Catatan: Forge tidak punya URL instalasi publik terpisah — aplikasi muncul di dalam Jira (panel issue + agen Rovo). Kalau Devpost meminta "installation link", pakai URL situs Jira di atas; link "share app" dari developer console (https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app) masih harus dibuat lewat browser bila diperlukan. Verifikasi visual panel di Jira juga masih butuh langkah browser.
