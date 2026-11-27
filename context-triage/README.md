# Context Triage

A Forge app for Jira that gives software teams the context to ship with
confidence — plus a Rovo agent and MCP tools that answer work-status
questions from the same live Jira data.

## Install (development)

Requires: Node.js 22+, Forge CLI 16 (`npm install -g @forge/cli`), a free
Atlassian Cloud Developer site, and `forge login`.

```bash
cd context-triage
npm install
forge register        # already done 24 Nov 2026; re-run only for a fresh clone
forge deploy
forge install --site <your-dev-site>.atlassian.net
```

If `forge` fails with `EPERM chown` on its config dir (seen on some Linux
VMs), use a separate config home: `export XDG_CONFIG_HOME=/tmp/forge-config`.

## Use

1. Open any Jira issue, click the **Context Triage** panel button. The panel
   shows linked issues, recent activity, decisions from comments, a suggested
   next step, and a suggested assignee (with reasons).
2. In Rovo Chat, talk to **Triage Assistant**:
   - "What is the status of PROJ-123?"
   - "Which linked issues are still open?"
   - "Who should work on this issue next?"
   - "Which issues in PROJ have gone stale?"
3. In Rovo Studio, add the **Context Triage MCP** server to a custom agent
   — tools: `get-issue-context`, `find-stalled-issues`, `suggest-assignee`.

## Develop / test

```bash
npm test          # 16 unit tests, mock Jira client, no credentials needed
```

Backend logic lives in `src/triage.js` (pure functions, no Forge imports).
`src/jira.js` is the only file that talks to Jira (read-only, as the viewing
user). No paid APIs, no Forge LLM, no secrets in the repo.

## Modules (manifest.yml)

| Module | Key | Purpose |
| --- | --- | --- |
| `jira:issuePanel` | `context-triage-panel` | Panel inside a Jira issue (UI Kit 2) |
| `rovo:agent` | `triage-assistant` | Rovo agent answering status questions |
| `action` | `get-issue-context` | Full triage context for one issue (GET) |
| `action` | `find-stalled-issues` | Issues untouched for N days (GET) |
| `action` | `suggest-assignee` | Ranked assignee suggestions (GET) |
| `rovo:mcp` | `context-triage-mcp` | Exposes the 3 actions as MCP tools |

Scopes: `read:jira-work`, `read:jira-user` (read-only). Note: `search:jira`
is NOT a valid Forge scope — it was removed from the manifest on 24 Nov
2026 after `forge lint` rejected it.
