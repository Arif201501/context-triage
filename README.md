# Codegeist 2026 — Context Triage

Forge app for Jira + Rovo agent + MCP tools. Entry for **Codegeist 2026**
(Devpost, sponsor Atlassian). Category: **Apps for Software Teams**.
Bonus prizes targeted: **Best Agents — Rovo/Assignable agents** and
**Best app with Atlassian MCP**.

- **Deadline:** 22 Dec 2026, 12:00 PT = **23 Dec 2026, 03:00 WIB**
- **Status (23 Nov 2026):** app code complete and verified as far as possible
  without an Atlassian login. Deploy + installation link still need browser
  steps (see below). ~29 days left.
- **Cost:** $0. No Forge LLM, no paid API anywhere. AI features use Rovo
  (free, included in the Forge/Rovo platform).

## What it does

**Context Triage** puts the context a developer needs right inside a Jira
issue, instead of making them hunt across tabs:

1. **Issue panel (Jira)** — "Context Triage" panel on any issue showing:
   - linked issues with status + assignee,
   - recent activity (comments + status changes),
   - decisions mentioned in comments (detected heuristically, no LLM),
   - a suggested next step (blockers → missing owner → staleness → linked work),
   - a suggested assignee, ranked by recent participation, ownership of
     linked work, and current open workload — with reasons shown.
2. **Triage Assistant (Rovo agent)** — chat in Rovo/Jira: "What is the
   status of PROJ-123?", "Which issues in PROJ have gone stale?",
   "Who should work on this next?" All answers come from three read-only
   Forge actions (GET only — the agent can never assign, edit, or comment).
3. **MCP server (`rovo:mcp`)** — the same three actions exposed as MCP
   tools for custom agents in Rovo Studio and MCP-compatible clients, plus
   an open-source `skills/triage-context/SKILL.md` any agent can adopt.

## Repo layout

```
codegeist-2026/
├── README.md                  # this file
├── SUBMISSION.md              # Devpost submission draft (description + tech explanation)
├── context-triage/            # the Forge app
│   ├── manifest.yml           # modules: jira:issuePanel, rovo:agent, action x3,
│   │                          #   rovo:mcp, function x4; scopes: read:jira-work,
│   │                          #   read:jira-user, search:jira; runtime nodejs24.x
│   ├── package.json
│   ├── src/
│   │   ├── index.js           # Forge function handlers (thin wrappers)
│   │   ├── triage.js          # pure triage logic (unit-tested, no Forge deps)
│   │   ├── jira.js            # Jira Cloud REST client via @forge/api (asUser, read-only)
│   │   ├── frontend/index.jsx # issue panel UI (Forge UI Kit 2 / @forge/react)
│   │   └── prompts/agent-prompt.md   # Rovo agent system prompt
│   ├── static/                # panel + agent icons (SVG)
│   ├── skills/triage-context/SKILL.md
│   └── test/triage.test.js    # 10 unit tests, mock Jira client, no credentials
└── .gitignore
```

## What is verified (23 Nov 2026, this machine, no login)

- [x] Forge CLI 16.0.0 installed (`npm install -g @forge/cli`).
- [x] `npm install` resolves cleanly — @forge/api 8.5.1, @forge/react
      11.17.0, @forge/resolver 1.8.0, @forge/bridge 5.17.0 (550 packages).
- [x] `npm test` — **10/10 unit tests pass** (decision extraction, next-step
      rules, assignee ranking, full context assembly, stalled search).
- [x] `node --check` clean on all backend sources; `src/index.js` imports
      and exposes all four handlers (`resolverHandler`, `getIssueContext`,
      `findStalledIssues`, `suggestAssignee`).
- [x] Frontend bundles with esbuild (JSX compiles; all 10 UI Kit components
      used confirmed present in @forge/react 11.17 typings).
- [x] Manifest parses as YAML and all cross-references check out (agent →
      actions, MCP → actions, actions → functions, panel → resolver).
- [x] `forge lint` parsed the manifest locally and caught one real bug
      (prompt resource must point at a directory) — fixed.
- [x] Rules re-checked against https://codegeist2026.devpost.com/rules on
      23 Nov 2026: Forge + ≥1 Atlassian product, new project, installation
      link required, demo video <5 min on YouTube, description + tech
      explanation required. Indonesia is not on the excluded list.
- [ ] **NOT yet verified (needs browser/login):** `forge deploy`, install on
      a dev Jira site, panel rendering in a real issue, Rovo agent answers,
      MCP tools in Rovo Studio, installation link. See next section.

## Steps that need a browser (for parent — DO NOT skip)

These were deliberately **not** done here (no login steps allowed in this
task). Each is free; none needs KYC.

1. **Atlassian account + free Cloud Developer site** — sign up at
   https://developer.atlassian.com/cloud/ (free Atlassian Cloud Developer
   license). Creates the Jira test site where the app will be installed.
2. **`forge login`** — in a browser-capable session, run `forge login` and
   complete Atlassian auth (or set `FORGE_EMAIL` + `FORGE_API_TOKEN` from an
   Atlassian API token).
3. **Register the app + replace the placeholder id** — run
   `forge register` (or `forge create` flow) inside `context-triage/`; it
   writes the real `app.id` into `manifest.yml`, replacing the placeholder
   `ari:cloud:ecosystem::app/00000000-0000-0000-0000-000000000000`.
   Then `forge deploy` and `forge install --site <your-dev-site>`.
   Note: `forge create` non-interactive also demands a Developer Space id
   (`forge developer-spaces list`), which itself needs login — that is why
   the app was hand-scaffolded from the official manifest references
   instead of `forge create`.
4. **Test on the dev site** — open a Jira issue with linked issues +
   comments, click the Context Triage panel; ask Triage Assistant the four
   conversation starters in Rovo Chat; check the MCP tools appear in
   Rovo Studio.
5. **Installation link for judges** — `forge install --site ...` /
   "start sharing your app" flow in the developer console produces the
   installation link; paste it into the Devpost submission (see
   SUBMISSION.md). Instructions:
   https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app
6. **Devpost submission** — free Devpost account, "Join Hackathon", fill the
   form with SUBMISSION.md text, upload the <5 min YouTube demo video
   (separate step, not done here), attach the installation link.
   W-8BEN tax form is only for winners — not needed now.

## Demo script (for the video, ~3 min)

1. Open a Jira issue with a blocker link + an undecided comment thread.
2. Click the Context Triage panel: linked issues, recent activity,
   decisions, suggested next step ("Unblock …"), suggested assignee.
3. Rovo Chat → Triage Assistant: "What is the status of PROJ-123?" and
   "Which issues in PROJ have gone stale?" — show grounded answers.
4. Rovo Studio: show the three Context Triage MCP tools.
5. Close: no data left Jira; every action is read-only.

## Environment quirks found

- `forge` commands are slow on first run (telemetry/config init) and the
  default `~/.config/@forge` dir hit an `EPERM chown` error in this VM.
  Workaround that works: `export XDG_CONFIG_HOME=/tmp/forge-config`.
  Usage analytics already set to false in that config.
- `forge lint` in CLI 16 requires login after the manifest parses — so full
  lint/deploy validation is blocked until step 2 above.
- `@forge/resolver` 1.8: `import Resolver from '@forge/resolver'` does NOT
  give a constructor under plain Node ESM (CJS interop); the code uses the
  named `makeResolver` export instead, which works everywhere.
