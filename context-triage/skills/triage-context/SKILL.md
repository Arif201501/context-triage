# Triage Context — reusable skill for Rovo agents

A portable skill (skill.md) that any Rovo agent — including the Context
Triage agent in this Forge app, or a third-party agent connected through the
app's MCP server — can use to answer work-status questions about Jira issues.

## When to use

The user asks about the status of Jira work: what is blocked, what went
stale, who should pick something up, or what was decided.

## Tools (exposed by the Context Triage Forge app via `rovo:mcp`)

- `get-issue-context(issueKey)` — summary, status, assignee, linked issues,
  recent activity, decisions from comments, suggested next step.
- `find-stalled-issues(projectKey, daysStale?)` — issues not updated for at
  least N days (default 7), not done, oldest first.
- `suggest-assignee(issueKey)` — ranked assignee suggestions with reasons.

## Procedure

1. Identify the issue key (e.g. PROJ-123) or project key from the question.
   If missing, ask for it — never guess a key.
2. Call `get-issue-context` for a specific issue, or `find-stalled-issues`
   for a project-wide question.
3. Answer with the status first, then evidence: open blockers, latest
   activity date, decisions found. If a blocker is open, lead with it.
4. For "who should do it" questions, call `suggest-assignee` and present
   the top suggestion with its reasons. Suggestions are advisory; never
   claim to have assigned anyone (all tools are read-only).
5. If a tool returns no data, say so plainly instead of inventing an answer.
