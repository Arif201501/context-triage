/**
 * jira.js — thin Jira Cloud REST client built on @forge/api.
 * All calls run as the viewing user (asUser), so the app only ever sees
 * what that user is allowed to see. Read-only: no write calls exist.
 */
import api, { route } from '@forge/api';

const ISSUE_FIELDS = [
  'summary', 'status', 'assignee', 'reporter', 'priority',
  'issuelinks', 'comment', 'updated', 'created', 'project',
].join(',');

async function check(res, what) {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jira API ${what} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

export function createJiraClient() {
  return {
    async getIssue(issueKey) {
      const res = await api.asUser().requestJira(
        route`/rest/api/3/issue/${issueKey}?fields=${ISSUE_FIELDS}&expand=changelog`,
        { headers: { Accept: 'application/json' } },
      );
      return check(res, `get issue ${issueKey}`);
    },

    async searchIssues(jql, fields = ['summary', 'status', 'assignee', 'updated']) {
      const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql, fields, maxResults: 50 }),
      });
      const data = await check(res, 'search issues');
      return data.issues || [];
    },

    async getAssignableUsers(issueKey) {
      const res = await api.asUser().requestJira(
        route`/rest/api/3/user/assignable/search?issueKey=${issueKey}&maxResults=10`,
        { headers: { Accept: 'application/json' } },
      );
      const users = await check(res, 'assignable users');
      return users.map((u) => ({ accountId: u.accountId, displayName: u.displayName }));
    },
  };
}
