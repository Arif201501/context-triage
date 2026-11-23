/**
 * index.jsx — Context Triage issue panel (Forge UI Kit 2, @forge/react).
 * Shows, for the issue the panel is opened on: linked issues, recent
 * activity, decisions found in comments, a suggested next step, and a
 * suggested assignee. Data comes from the `getContext` resolver.
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Link,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const statusTone = (category) => {
  if (category === 'done') return 'success';
  if (category === 'indeterminate') return 'inprogress';
  return 'new';
};

function LinkedIssues({ links }) {
  if (!links || links.length === 0) {
    return <Text>No linked issues.</Text>;
  }
  return (
    <Stack space="space.100">
      {links.map((l) => (
        <Box key={`${l.direction}-${l.key}`}>
          <Text>
            <Link href={`/browse/${l.key}`}>{l.key}</Link>
            {` — ${l.summary} `}
            <Lozenge appearance={statusTone(l.statusCategory)}>{l.status}</Lozenge>
            {` (${l.linkType}${l.assignee ? `, ${l.assignee}` : ''})`}
          </Text>
        </Box>
      ))}
    </Stack>
  );
}

function Activity({ events }) {
  if (!events || events.length === 0) return <Text>No recent activity.</Text>;
  return (
    <Stack space="space.100">
      {events.map((e, i) => (
        <Text key={i}>
          {e.kind === 'comment' ? '💬' : '🔀'} {e.author} · {new Date(e.at).toLocaleDateString()}
          {` — ${e.text}`}
        </Text>
      ))}
    </Stack>
  );
}

function DecisionLedger({ ledger }) {
  if (!ledger || !ledger.entries || ledger.entries.length === 0) {
    return <Text>No decisions recorded yet.</Text>;
  }
  return (
    <Stack space="space.100">
      {ledger.stale && ledger.staleWarning && (
        <SectionMessage title="Stale context" appearance="warning">
          <Text>{ledger.staleWarning}</Text>
        </SectionMessage>
      )}
      {ledger.entries.map((d, i) => (
        <Text key={i}>
          “{d.text}” — {d.author}, {new Date(d.created).toLocaleDateString()}
          {d.source === 'changelog' ? ' (from changelog)' : ''}
          {d.url ? (
            <>
              {' '}
              <Link href={d.url}>View source</Link>
            </>
          ) : null}
        </Text>
      ))}
    </Stack>
  );
}

function HandoffReadiness({ readiness }) {
  if (!readiness) return null;
  const verdictTone =
    readiness.verdict === 'Ready' ? 'success' : readiness.verdict === 'Almost ready' ? 'inprogress' : 'removed';
  const riskTone =
    readiness.blockerRisk === 'Low' ? 'success' : readiness.blockerRisk === 'Medium' ? 'inprogress' : 'removed';
  return (
    <Stack space="space.100">
      <Text>
        Score: <strong>{readiness.score}/100</strong>{' '}
        <Lozenge appearance={verdictTone}>{readiness.verdict}</Lozenge>
        {' '}Blocker risk: <Lozenge appearance={riskTone}>{readiness.blockerRisk}</Lozenge>
      </Text>
      {readiness.breakdown.map((b, i) => (
        <Text key={i}>
          {b.points > 0 ? '✓' : '○'} {b.label} — {b.points}/20 ({b.detail})
        </Text>
      ))}
    </Stack>
  );
}

function App() {
  const context = useProductContext();
  const issueKey = context?.platformContext?.issueKey;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!issueKey) return;
    invoke('getContext', { issueKey })
      .then(setData)
      .catch((e) => setError(e?.message || String(e)));
  }, [issueKey]);

  if (!issueKey) return <Text>Open this panel on a Jira issue to see its context.</Text>;
  if (error) {
    return (
      <SectionMessage title="Could not load triage context" appearance="error">
        <Text>{error}</Text>
      </SectionMessage>
    );
  }
  if (!data) return <Spinner size="medium" label="Loading triage context" />;

  const topAssignee = data.suggestedAssignees?.[0];
  return (
    <Stack space="space.200">
      <Heading as="h3">
        {data.key} — {data.summary}
      </Heading>
      <Text>
        <Lozenge appearance={statusTone(data.statusCategory)}>{data.status}</Lozenge>
        {` Assignee: ${data.assignee || 'Unassigned'} · Updated: ${new Date(data.updated).toLocaleDateString()}`}
      </Text>

      <SectionMessage title="Suggested next step" appearance="information">
        <Text>{data.nextStep.text}</Text>
        <Text>{`Why: ${data.nextStep.reason}`}</Text>
      </SectionMessage>

      {topAssignee && (
        <Text>
          Suggested assignee: <strong>{topAssignee.displayName}</strong>
          {topAssignee.reasons.length > 0 ? ` — ${topAssignee.reasons.join('; ')}` : ''}
        </Text>
      )}

      <Heading as="h4">Linked issues ({data.linkedIssues.length})</Heading>
      <LinkedIssues links={data.linkedIssues} />

      <Heading as="h4">Recent activity</Heading>
      <Activity events={data.recentActivity} />

      <Heading as="h4">Decision Ledger</Heading>
      <DecisionLedger ledger={data.decisionLedger || { entries: data.decisions || [], stale: false, staleWarning: null }} />

      <Heading as="h4">Handoff readiness</Heading>
      <HandoffReadiness readiness={data.handoffReadiness} />

      <Heading as="h4">Handoff draft</Heading>
      {data.handoffDraft ? (
        <Stack space="space.100">
          {data.handoffDraft.split('\n').map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          <Text>
            Suggested draft — copy it to post as a Jira comment yourself. This app is read-only and never posts comments.
          </Text>
        </Stack>
      ) : (
        <Text>No handoff draft available.</Text>
      )}

      <Button
        appearance="subtle"
        onClick={() => {
          setData(null);
          invoke('getContext', { issueKey }).then(setData).catch((e) => setError(e?.message || String(e)));
        }}
      >
        Refresh
      </Button>
    </Stack>
  );
}

ForgeReconciler.render(<App />);
