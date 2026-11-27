# Demo Video Script — Context Triage (Codegeist 2026)

Target: ≤ 3 min (aim ~2:00). Language: English (Devpost / Atlassian judges).
Footage: real screen capture of the deployed app (Jira panel + Rovo agent).
VO: Bodi (Google AI Studio TTS), -14 LUFS. Subtitles: English, medium size.

## Verified facts to show (do not invent numbers)
- App: "Context Triage", Forge app v2.0.0, deployed 24 Nov 2026.
  (Koreksi 27 Nov 2026: sebelumnya tertulis v2.2.0 — salah; laporan
  deploy mencatat v2.0.0.)
- Jira panel on issue TT-1 (Triage Test project):
  - Suggested next step: "Assign an owner so this issue has someone driving it"
  - Suggested assignee: Blow X outsiders
  - Handoff Readiness: 60/100 — "Almost ready"
  - Blocker risk: Low
  - Score breakdown: Owner 0/20, No open blockers 20/20, Recently active 20/20, Decisions 0/20, Linked work 20/20
  - Handoff draft + Refresh button
- Rovo agent "Triage Assistant" (demo site, enterprise Jira):
  - get-issue-context — returns readiness 60/100, next step, assignee
  - find-stalled-issues — correctly reports none stale
  - suggest-assignee — Blow X outsiders top, runner-up "JSM Queue Guardrail Agent", advisory-only note
- Sites: dev https://context-triage-dev.atlassian.net/ (Jira Free, panel) and demo https://one-atlas-svoo.atlassian.net (enterprise, Rovo).
- Repo: https://github.com/Arif201501/context-triage

## Script (VO + shots)

### 0:00–0:15 — The problem
VO: "Every handoff in Jira loses context. Someone picks up an issue and has to dig through comments, links, and decisions just to figure out what to do next."
Shot: Jira issue view, scrolling through a long comment thread (TT-1).

### 0:15–0:45 — The panel
VO: "Context Triage reads the issue for you. Open any issue and the panel tells you, in one glance, whether it is ready to hand off."
Shot: Panel opens on TT-1. Highlight: Handoff Readiness 60/100 "Almost ready", Blocker risk Low, the five score bars.
VO: "It scores what actually blocks a handoff: is there an owner, are there open blockers, is it recently active, are decisions recorded, is the work linked."
Shot: Score breakdown (Owner 0/20, No open blockers 20/20, Recently active 20/20, Decisions 0/20, Linked work 20/20).

### 0:45–1:10 — Next step + assignee + draft
VO: "Then it tells you the one next step, who should pick it up, and drafts the handoff for you."
Shot: Suggested next step "Assign an owner so this issue has someone driving it"; suggested assignee Blow X outsiders; handoff draft text; Refresh button click → scores reload.

### 1:10–1:40 — Rovo agent
VO: "The same brain lives in Rovo. Ask Triage Assistant about any issue, in plain words."
Shot: Rovo Chat, "Change agent" → Triage Assistant. Ask: "Is TT-1 ready to hand off?" Agent answers with readiness 60/100, next step, assignee.
VO: "It can also find stalled work, and suggest who should take it — always advisory, never auto-assigning."
Shot: find-stalled-issues → "none stale"; suggest-assignee → Blow X outsiders top, advisory-only note visible.

### 1:40–2:00 — Close
VO: "Context Triage. Every handoff, ready — with the context intact."
Shot: Panel + Rovo side by side, then end card: "Context Triage — Codegeist 2026" + repo URL github.com/Arif201501/context-triage.
End card text: like and subscribe — NO. (Hackathon demo: no CTA, just title + repo.)

## Production notes
- Capture real screen recordings (Jira panel + Rovo), not static screenshots with slow zoom. If a real screen recording is not possible, animate the panel UI in code (motion_stark) with real movement.
- No AI-slop phrasing in VO. Keep sentences short.
- Bodi VO pop fix: TRIM at last-word-end +0.05s + fade-in 0.02s + fade-out 0.05s; verify 0 samples ≥0.95 at 24 kHz and after 44.1 kHz resample; loudness -14 LUFS.
- Subtitles: English, medium size, synced.
- Deliverable: MP4 ≤ 3 min, 1080p, attached in chat for bos approval before Devpost submit.
