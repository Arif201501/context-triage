/**
 * triage.js — pure triage logic for Context Triage.
 *
 * Deliberately free of any Forge / Atlassian import so it can be unit-tested
 * with plain `node --test` using a mock Jira client. No paid API is used
 * anywhere: decisions and suggestions are deterministic heuristics over data
 * that already lives in Jira (comments, changelog, links, assignees).
 *
 * The Jira client interface expected by the builders below:
 *   jira.getIssue(issueKey)            -> Jira issue JSON (fields + changelog)
 *   jira.searchIssues(jql, fields)     -> array of issue JSON
 *   jira.getAssignableUsers(issueKey)  -> array of { accountId, displayName }
 */

// Statuses that mean "no more work needed" for staleness / next-step rules.
const DONE_CATEGORIES = new Set(['done']);
const BLOCKER_LINK_TYPES = new Set(['is blocked by', 'blocks', 'blocked by']);

/** Flatten Atlassian Document Format (ADF) rich text to plain text. */
export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (Array.isArray(node.content)) {
    return node.content.map(adfToText).join(node.type === 'paragraph' || node.type === 'heading' ? '\n' : '');
  }
  return '';
}

// Fetch-depth caps (review feedback): keep the panel cheap and the context
// fresh — never pull more than a handful of links or the last few comments.
export const MAX_LINKED_ISSUES = 5;
export const MAX_RECENT_COMMENTS = 10;
export const STALE_DECISION_DAYS = 30;

const DECISION_RE = /\b(decid|decision|agreed|agreement|concluded|resolved to|kita pakai|kita pilih|setuju|sepakat|dipilih|diputuskan|disepakati|kesepakatan|final)/i;

/**
 * Pull decision-like comments out of the issue comment list (input order
 * preserved). Each entry carries a link to its source comment when an
 * issueKey is given; without one, `url` is null (keeps the old
 * extractDecisions(comments) call shape working).
 */
export function extractDecisions(comments = [], issueKey = null) {
  return comments
    .map((c) => ({
      author: c.author?.displayName || 'Unknown',
      created: c.created,
      text: adfToText(c.body).trim(),
      source: 'comment',
      commentId: c.id || null,
      url: issueKey && c.id ? `/browse/${issueKey}?focusedCommentId=${c.id}` : null,
    }))
    .filter((c) => c.text && DECISION_RE.test(c.text));
}

/**
 * Build the Decision Ledger for an issue: decision-like comments from the
 * last MAX_RECENT_COMMENTS comments, plus a changelog entry each time the
 * status changed to Done. Entries are newest-first. `stale` is true when
 * the most recent recorded decision is older than STALE_DECISION_DAYS.
 */
export function buildDecisionLedger(issue, issueKey = null, now = new Date()) {
  const comments = (issue.fields?.comment?.comments || []).slice(-MAX_RECENT_COMMENTS);
  const entries = extractDecisions(comments, issueKey);
  for (const h of issue.changelog?.histories || []) {
    for (const item of h.items || []) {
      if (item.field === 'status' && (item.toString || '').toLowerCase() === 'done') {
        entries.push({
          author: h.author?.displayName || 'Unknown',
          created: h.created,
          text: `Status changed to Done (${item.fromString || '(none)'} → Done).`,
          source: 'changelog',
          commentId: null,
          url: issueKey ? `/browse/${issueKey}` : null,
        });
      }
    }
  }
  entries.sort((a, b) => new Date(b.created) - new Date(a.created));
  let stale = false;
  let staleWarning = null;
  if (entries.length > 0) {
    const latestMs = entries.reduce((max, e) => Math.max(max, new Date(e.created).getTime()), 0);
    const ageDays = daysSince(new Date(latestMs).toISOString(), now);
    if (ageDays > STALE_DECISION_DAYS) {
      stale = true;
      staleWarning = `Last recorded decision is ${Math.floor(ageDays)} days old (over ${STALE_DECISION_DAYS} days) — the context may be stale. Confirm the decision still stands before acting on it.`;
    }
  }
  return { entries, stale, staleWarning, count: entries.length };
}

/** Summarise the most recent activity: comments + status changes. */
export function recentActivity(issue, limit = 5) {
  const events = [];
  for (const c of issue.fields?.comment?.comments || []) {
    events.push({
      kind: 'comment',
      at: c.created,
      author: c.author?.displayName || 'Unknown',
      text: adfToText(c.body).trim().slice(0, 280),
    });
  }
  for (const h of issue.changelog?.histories || []) {
    for (const item of h.items || []) {
      if (item.field === 'status') {
        events.push({
          kind: 'status',
          at: h.created,
          author: h.author?.displayName || 'Unknown',
          text: `${item.fromString || '(none)'} → ${item.toString}`,
        });
      }
    }
  }
  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

/** Normalise linked issues (both inward and outward links). */
export function linkedIssues(issue) {
  const out = [];
  for (const link of issue.fields?.issuelinks || []) {
    const other = link.outwardIssue || link.inwardIssue;
    if (!other) continue;
    out.push({
      key: other.key,
      summary: other.fields?.summary || '',
      status: other.fields?.status?.name || 'Unknown',
      statusCategory: other.fields?.status?.statusCategory?.key || '',
      assignee: other.fields?.assignee?.displayName || null,
      linkType: link.type?.outward && other === link.outwardIssue
        ? link.type.outward
        : link.type?.inward || link.type?.name || '',
      direction: other === link.outwardIssue ? 'outward' : 'inward',
    });
  }
  return out;
}

function daysSince(iso, now = new Date()) {
  return (now - new Date(iso)) / 86400000;
}

/**
 * Rule-based next step. Order matters: blockers first, then missing owner,
 * then staleness, then open linked work, then normal progress.
 */
export function suggestNextStep(issue, links, now = new Date()) {
  const status = issue.fields?.status?.name || '';
  const statusCategory = issue.fields?.status?.statusCategory?.key || '';
  const assignee = issue.fields?.assignee;
  const updated = issue.fields?.updated;
  const openBlockers = links.filter(
    (l) => BLOCKER_LINK_TYPES.has((l.linkType || '').toLowerCase()) && l.statusCategory !== 'done',
  );
  if (openBlockers.length > 0) {
    return {
      text: `Unblock this issue: ${openBlockers.map((l) => l.key).join(', ')} still open.`,
      reason: `${openBlockers.length} blocking linked issue(s) not done yet.`,
    };
  }
  if (!assignee) {
    return {
      text: 'Assign an owner so this issue has someone driving it.',
      reason: 'Issue currently has no assignee.',
    };
  }
  if (updated && daysSince(updated, now) > 7 && statusCategory !== 'done') {
    return {
      text: `Post a status update — nothing has changed for ${Math.floor(daysSince(updated, now))} days.`,
      reason: `Last updated ${Math.floor(daysSince(updated, now))} days ago.`,
    };
  }
  const openLinks = links.filter((l) => l.statusCategory !== 'done');
  if (openLinks.length > 0) {
    return {
      text: `Follow up on linked work: ${openLinks[0].key} (${openLinks[0].status}).`,
      reason: `${openLinks.length} linked issue(s) still open.`,
    };
  }
  if (statusCategory === 'done') {
    return { text: 'Done — no further action. Close out any linked follow-ups.', reason: `Status is ${status}.` };
  }
  return {
    text: `Move "${status}" forward: confirm the next concrete deliverable with ${assignee.displayName}.`,
    reason: `Status is ${status}, assignee is set, no blockers.`,
  };
}

/**
 * Rank suggested assignees. Score: recent participation in this issue (+2 per
 * event), owning open linked work (+2 each), minus current open workload
 * (0.25 per open assigned issue, so busy people sink but are not excluded).
 * Only users assignable to the issue are candidates.
 */
export async function suggestAssignees(jira, issue, links, limit = 3) {
  const candidates = await jira.getAssignableUsers(issue.key);
  const participants = new Map();
  for (const e of recentActivity(issue, 20)) {
    participants.set(e.author, (participants.get(e.author) || 0) + 1);
  }
  const scored = [];
  for (const u of candidates) {
    let score = 0;
    const reasons = [];
    const part = participants.get(u.displayName) || 0;
    if (part > 0) { score += 2 * part; reasons.push(`active here (${part} recent event${part > 1 ? 's' : ''})`); }
    const ownsLinks = links.filter((l) => l.assignee === u.displayName && l.statusCategory !== 'done').length;
    if (ownsLinks > 0) { score += 2 * ownsLinks; reasons.push(`owns ${ownsLinks} open linked issue(s)`); }
    let openCount = 0;
    try {
      const mine = await jira.searchIssues(
        `assignee = "${u.accountId}" AND statusCategory != Done`,
        ['key'],
      );
      openCount = mine.length;
    } catch { openCount = 0; }
    score -= 0.25 * openCount;
    if (openCount > 0) reasons.push(`${openCount} open issue(s) assigned`);
    scored.push({ accountId: u.accountId, displayName: u.displayName, score: Math.round(score * 100) / 100, reasons });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Handoff Readiness Score (0–100): five components worth 20 points each,
 * all computed from data already fetched — no extra API calls.
 * Verdict: >=80 Ready, 50–79 Almost ready, <50 Not ready.
 * Blocker Risk: High if a blocker is open, Medium if other linked work is
 * open, Low otherwise.
 */
export function handoffReadiness(issue, links, decisions, now = new Date()) {
  const breakdown = [];
  let score = 0;

  const hasOwner = !!issue.fields?.assignee;
  breakdown.push({
    label: 'Owner assigned',
    points: hasOwner ? 20 : 0,
    detail: hasOwner ? `Owner: ${issue.fields.assignee.displayName}` : 'No assignee yet',
  });
  if (hasOwner) score += 20;

  const openBlockers = links.filter(
    (l) => BLOCKER_LINK_TYPES.has((l.linkType || '').toLowerCase()) && l.statusCategory !== 'done',
  );
  const noBlockers = openBlockers.length === 0;
  breakdown.push({
    label: 'No open blockers',
    points: noBlockers ? 20 : 0,
    detail: noBlockers
      ? 'No blocking issues open'
      : `${openBlockers.length} blocker(s) still open: ${openBlockers.map((l) => l.key).join(', ')}`,
  });
  if (noBlockers) score += 20;

  const updated = issue.fields?.updated;
  const recent = !!updated && daysSince(updated, now) <= 7;
  breakdown.push({
    label: 'Recently active',
    points: recent ? 20 : 0,
    detail: updated
      ? `Last updated ${Math.floor(daysSince(updated, now))} day(s) ago`
      : 'No update date recorded',
  });
  if (recent) score += 20;

  const decisionCount = Array.isArray(decisions) ? decisions.length : 0;
  const hasDecisions = decisionCount > 0;
  breakdown.push({
    label: 'Decisions recorded',
    points: hasDecisions ? 20 : 0,
    detail: hasDecisions ? `${decisionCount} decision(s) recorded` : 'No decisions recorded yet',
  });
  if (hasDecisions) score += 20;

  const openLinks = links.filter((l) => l.statusCategory !== 'done');
  const linksResolved = openLinks.length === 0;
  breakdown.push({
    label: 'Linked work resolved',
    points: linksResolved ? 20 : 0,
    detail: linksResolved
      ? 'All linked work is done (or nothing linked)'
      : `${openLinks.length} linked issue(s) still open`,
  });
  if (linksResolved) score += 20;

  const verdict = score >= 80 ? 'Ready' : score >= 50 ? 'Almost ready' : 'Not ready';
  const blockerRisk = openBlockers.length > 0 ? 'High' : openLinks.length > 0 ? 'Medium' : 'Low';

  return { score, verdict, blockerRisk, breakdown };
}

/**
 * Draft a handoff comment as plain text (a suggestion only — the app is
 * read-only and never posts comments). Includes key, summary, status,
 * assignee, next step, recorded decisions, the suggested assignee, and the
 * readiness score.
 */
export function draftHandoffComment(ctx) {
  const decisions = ctx.decisionLedger?.entries || ctx.decisions || [];
  const topAssignee = ctx.suggestedAssignees?.[0];
  const lines = [
    `Handoff for ${ctx.key} — ${ctx.summary}`,
    `Status: ${ctx.status}${ctx.assignee ? ` · Assignee: ${ctx.assignee}` : ' · Unassigned'}`,
    `Next step: ${ctx.nextStep?.text || '(none suggested)'}`,
  ];
  if (decisions.length > 0) {
    lines.push(`Decisions: ${decisions.slice(0, 3).map((d) => `"${d.text}"`).join('; ')}`);
  } else {
    lines.push('Decisions: none recorded yet.');
  }
  if (topAssignee) {
    lines.push(
      `Suggested assignee: ${topAssignee.displayName}${topAssignee.reasons?.length ? ` (${topAssignee.reasons.join('; ')})` : ''}`,
    );
  }
  if (ctx.handoffReadiness) {
    lines.push(`Handoff readiness: ${ctx.handoffReadiness.score}/100 (${ctx.handoffReadiness.verdict}, blocker risk ${ctx.handoffReadiness.blockerRisk})`);
  }
  return lines.join('\n');
}

/** Build the whole triage context object for one issue. */
export async function buildIssueContext(jira, issueKey) {
  const issue = await jira.getIssue(issueKey);
  const f = issue.fields || {};
  const links = linkedIssues(issue).slice(0, MAX_LINKED_ISSUES);
  const activity = recentActivity(issue, 5);
  const decisionLedger = buildDecisionLedger(issue, issueKey);
  const decisions = decisionLedger.entries;
  const nextStep = suggestNextStep(issue, links);
  const assignees = await suggestAssignees(jira, issue, links, 3);
  const readiness = handoffReadiness(issue, links, decisionLedger.entries);
  const ctx = {
    key: issue.key,
    summary: f.summary || '',
    status: f.status?.name || 'Unknown',
    statusCategory: f.status?.statusCategory?.key || '',
    priority: f.priority?.name || null,
    assignee: f.assignee?.displayName || null,
    reporter: f.reporter?.displayName || null,
    created: f.created,
    updated: f.updated,
    projectKey: f.project?.key || null,
    linkedIssues: links,
    recentActivity: activity,
    decisions,
    decisionLedger,
    nextStep,
    suggestedAssignees: assignees,
    handoffReadiness: readiness,
    handoffDraft: '',
  };
  ctx.handoffDraft = draftHandoffComment(ctx);
  return ctx;
}

/** Issues in a project untouched for >= daysStale days and not done. */
export async function findStalled(jira, projectKey, daysStale = 7) {
  const issues = await jira.searchIssues(
    `project = ${projectKey} AND statusCategory != Done AND updated <= -${daysStale}d ORDER BY updated ASC`,
    ['summary', 'status', 'assignee', 'updated'],
  );
  return issues.map((i) => ({
    key: i.key,
    summary: i.fields?.summary || '',
    status: i.fields?.status?.name || 'Unknown',
    assignee: i.fields?.assignee?.displayName || null,
    updated: i.fields?.updated,
    daysStale: i.fields?.updated ? Math.floor(daysSince(i.fields.updated)) : null,
  }));
}
