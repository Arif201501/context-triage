/**
 * Unit tests for src/triage.js — run with `npm test` (node --test).
 * No Atlassian credentials needed: a mock Jira client stands in for the API.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adfToText,
  extractDecisions,
  linkedIssues,
  suggestNextStep,
  suggestAssignees,
  buildIssueContext,
  findStalled,
} from '../src/triage.js';

const adf = (text) => ({
  type: 'doc',
  version: 1,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function makeIssue(overrides = {}) {
  return {
    key: 'PROJ-123',
    fields: {
      summary: 'Fix login redirect',
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      assignee: { displayName: 'Ana', accountId: 'ana-1' },
      reporter: { displayName: 'Ben', accountId: 'ben-1' },
      priority: { name: 'High' },
      project: { key: 'PROJ' },
      created: '2026-11-01T10:00:00.000Z',
      updated: new Date().toISOString(),
      issuelinks: [],
      comment: { comments: [] },
      ...overrides,
    },
    changelog: { histories: [] },
  };
}

const mockJira = (issue, extra = {}) => ({
  getIssue: async () => issue,
  searchIssues: async (jql) => {
    if (extra.search) return extra.search(jql);
    return [];
  },
  getAssignableUsers: async () => extra.users || [
    { accountId: 'ana-1', displayName: 'Ana' },
    { accountId: 'ben-1', displayName: 'Ben' },
  ],
});

test('adfToText flattens paragraphs', () => {
  assert.equal(adfToText(adf('hello world')), 'hello world');
  assert.equal(adfToText(null), '');
});

test('extractDecisions picks decision comments only', () => {
  const comments = [
    { author: { displayName: 'Ana' }, created: '2026-11-20T00:00:00.000Z', body: adf('We decided to use OAuth.') },
    { author: { displayName: 'Ben' }, created: '2026-11-21T00:00:00.000Z', body: adf('Looks good to me') },
    { author: { displayName: 'Ana' }, created: '2026-11-22T00:00:00.000Z', body: adf('Agreed, shipping on Monday.') },
  ];
  const found = extractDecisions(comments);
  assert.equal(found.length, 2);
  assert.match(found[0].text, /decided/);
});

test('suggestNextStep: open blocker wins', () => {
  const issue = makeIssue();
  const links = [{ key: 'PROJ-100', status: 'To Do', statusCategory: '', linkType: 'is blocked by' }];
  const step = suggestNextStep(issue, links);
  assert.match(step.text, /Unblock/);
  assert.match(step.text, /PROJ-100/);
});

test('suggestNextStep: no assignee', () => {
  const issue = makeIssue({ assignee: null });
  const step = suggestNextStep(issue, []);
  assert.match(step.text, /Assign an owner/);
});

test('suggestNextStep: stale issue asks for an update', () => {
  const issue = makeIssue({ updated: '2026-11-01T10:00:00.000Z' });
  const step = suggestNextStep(issue, [], new Date('2026-11-23T10:00:00.000Z'));
  assert.match(step.text, /status update/);
});

test('suggestNextStep: done issue needs nothing', () => {
  const issue = makeIssue({ status: { name: 'Done', statusCategory: { key: 'done' } } });
  const step = suggestNextStep(issue, []);
  assert.match(step.text, /Done/);
});

test('linkedIssues normalises inward and outward links', () => {
  const issue = makeIssue({
    issuelinks: [{
      type: { outward: 'relates to', inward: 'relates to' },
      outwardIssue: {
        key: 'PROJ-200', fields: {
          summary: 'Related work',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          assignee: { displayName: 'Ben' },
        },
      },
    }],
  });
  const links = linkedIssues(issue);
  assert.equal(links.length, 1);
  assert.equal(links[0].key, 'PROJ-200');
  assert.equal(links[0].direction, 'outward');
});

test('suggestAssignees ranks active participant above idle candidate', async () => {
  const issue = makeIssue({
    comment: { comments: [
      { author: { displayName: 'Ben' }, created: new Date().toISOString(), body: adf('Working on it') },
      { author: { displayName: 'Ben' }, created: new Date().toISOString(), body: adf('Update: almost done') },
    ] },
  });
  const jira = mockJira(issue, { search: async () => [] });
  const ranked = await suggestAssignees(jira, issue, []);
  assert.equal(ranked[0].displayName, 'Ben');
  assert.ok(ranked[0].score > ranked[1].score);
});

test('buildIssueContext assembles the full panel payload', async () => {
  const issue = makeIssue({
    issuelinks: [{
      type: { outward: 'relates to', inward: 'relates to' },
      outwardIssue: {
        key: 'PROJ-200', fields: {
          summary: 'Related work',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          assignee: null,
        },
      },
    }],
    comment: { comments: [
      { author: { displayName: 'Ana' }, created: '2026-11-22T00:00:00.000Z', body: adf('We decided to ship it.') },
    ] },
  });
  const ctx = await buildIssueContext(mockJira(issue), 'PROJ-123');
  assert.equal(ctx.key, 'PROJ-123');
  assert.equal(ctx.linkedIssues.length, 1);
  assert.equal(ctx.decisions.length, 1);
  assert.equal(ctx.suggestedAssignees.length, 2);
  assert.ok(ctx.nextStep.text.length > 0);
});

test('findStalled maps search results', async () => {
  const jira = mockJira(null, {
    search: async (jql) => {
      assert.match(jql, /project = PROJ/);
      assert.match(jql, /-7d/);
      return [{
        key: 'PROJ-9',
        fields: {
          summary: 'Old bug', status: { name: 'To Do' },
          assignee: null, updated: '2026-11-01T00:00:00.000Z',
        },
      }];
    },
  });
  const stalled = await findStalled(jira, 'PROJ', 7);
  assert.equal(stalled.length, 1);
  assert.equal(stalled[0].key, 'PROJ-9');
  assert.ok(stalled[0].daysStale >= 7);
});
