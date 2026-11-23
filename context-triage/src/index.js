/**
 * index.js — Forge function handlers for Context Triage.
 * Thin wrappers: every handler builds a Jira client, delegates to the
 * testable logic in triage.js, and returns plain JSON.
 */
import { makeResolver } from '@forge/resolver';
import { createJiraClient } from './jira.js';
import { buildIssueContext, findStalled, suggestAssignees, linkedIssues } from './triage.js';

export const resolverHandler = makeResolver({
  getContext: async ({ payload }) => {
    const issueKey = payload?.issueKey;
    if (!issueKey || typeof issueKey !== 'string') {
      throw new Error('getContext requires an issueKey string.');
    }
    return buildIssueContext(createJiraClient(), issueKey);
  },
});

/** Rovo action: full triage context for one issue. */
export async function getIssueContext(payload) {
  const issueKey = payload?.issueKey;
  if (!issueKey) throw new Error('getIssueContext requires issueKey.');
  return buildIssueContext(createJiraClient(), issueKey);
}

/** Rovo action: stalled issues in a project. */
export async function findStalledIssues(payload) {
  const projectKey = payload?.projectKey;
  if (!projectKey) throw new Error('findStalledIssues requires projectKey.');
  const daysStale = Number(payload.daysStale) > 0 ? Number(payload.daysStale) : 7;
  return { projectKey, daysStale, issues: await findStalled(createJiraClient(), projectKey, daysStale) };
}

/** Rovo action: ranked assignee suggestions for one issue. */
export async function suggestAssignee(payload) {
  const issueKey = payload?.issueKey;
  if (!issueKey) throw new Error('suggestAssignee requires issueKey.');
  const jira = createJiraClient();
  const issue = await jira.getIssue(issueKey);
  const links = linkedIssues(issue);
  return {
    issueKey,
    suggestedAssignees: await suggestAssignees(jira, issue, links, 3),
  };
}
