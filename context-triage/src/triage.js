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

const DECISION_RE = /\b(decid|decision|agreed|agreement|concluded|resolved to|kesepakatan|diputuskan|disepakati)/i;

/** Pull decision-like comments out of the issue comment list (newest first). */
export function extractDecisions(comments = []) {
  return comments
    .map((c) => ({
      author: c.author?.displayName || 'Unknown',
      created: c.created,
      text: adfToText(c.body).trim(),
    }))
    .filter((c) => c.text && DECISION_RE.test(c.text))
    .slice(0, 3);
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

/** Build the whole triage context object for one issue. */
export async function buildIssueContext(jira, issueKey) {
  const issue = await jira.getIssue(issueKey);
  const f = issue.fields || {};
  const links = linkedIssues(issue);
  const comments = f.comment?.comments || [];
  const activity = recentActivity(issue, 5);
  const decisions = extractDecisions(comments);
  const nextStep = suggestNextStep(issue, links);
  const assignees = await suggestAssignees(jira, issue, links, 3);
  return {
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
    nextStep,
    suggestedAssignees: assignees,
  };
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
