# Forge deploy report — Context Triage — 2026-11-24

## Outcome

**SUCCESS — app deployed and installed.** The full chain completed on 2026-11-24 (WIB evening):
`forge login` → `forge register` → `forge deploy` → `forge install` on
https://context-triage-dev.atlassian.net/ (Jira, development environment, version 2.0.0).
Verified via `forge install list`: status **Up-to-date**.

## Login

- DONE by the parent before this run (this subagent did not run `forge login` and used no token value).
- Verified in this run: `forge whoami` → `Logged in as Blow X outsiders (blowxoutsiders@gmail.com)`,
  Account ID `712020:58d4c66b-b131-402f-b57d-fad0f9a74665`.
- Credential stored in the Forge config at `XDG_CONFIG_HOME=/tmp/forge-config`.
- Earlier blocker (now resolved by the parent): the Vault surrogate (`hsurr:`) could not be used
  by Forge CLI, because Forge sends the API token as HTTP Basic auth
  (`Basic base64("email:token")`), which hides the literal surrogate string so the runtime
  cannot swap it for the real token. See the "Root cause" section below for the verified detail.

## Register — SUCCESS

- App: **Context Triage**, app id `ari:cloud:ecosystem::app/c56add27-5527-4f0b-882a-01b86c199e1a`
  (replaced the placeholder UUID in `manifest.yml`).
- `forge register` output: "✔ Registered Context Triage — Your app is ready to work on, deploy,
  and install. We created 3 environments you can deploy to: production, staging, development."
- Prerequisite found and fixed in this run: the account had **no Developer Space**, and
  `forge register` cannot proceed without one.
  - `forge developer-spaces` has only a `list` subcommand (no `create`), and `forge register`
    has no option to supply a space name non-interactively.
  - Fix: drove the interactive `forge register` with `expect` (a PTY provider; `pty: true` is
    not supported by this VM's exec). Created Developer Space **context-triage-dev**,
    id `19523bb4-92cc-47ae-ac3b-be53f232dc3c`.
  - Note: `forge register --personal` FAILED after the space was created:
    `Error: Personal apps are not allowed in this developer space`. Registering **into** the
    space (no `--personal`, with `-s 19523bb4-92cc-47ae-ac3b-be53f232dc3c`) succeeded.

## Deploy — SUCCESS (after 2 manifest fixes)

- `forge deploy` → "✔ Deployed — Deployed Context Triage to the development environment."
  Deployed version **2.0.0** to **development**. Eligible for the Runs on Atlassian program.
- First deploy attempt failed at `forge lint` with 3 errors; all fixed in `manifest.yml`:
  1. Invalid scope `search:jira` removed (only `read:jira-work` and `read:jira-user` remain).
     `search:jira` is not a valid Forge permission.
  2. `get-issue-context` action `description` shortened from ~560 chars to **242 chars**
     (schema `maxLength: 255` for Rovo action descriptions). Verified with Python `jsonschema`
     against the bundled manifest schema: only `modules.action.0` failed, on the `oneOf`.
  3. The `suggest-assignee` "required properties" error was a knock-on of the same `oneOf`
     failure and cleared once the description was fixed (no separate change needed).
- After the fixes, `forge lint` → "No issues found." App tests still pass 16/16 (unchanged code;
  only the manifest was edited: scope list + one description string).
- Deploy note: "We've detected new scopes or egress URLs in your app. Run `forge install
  --upgrade`..." — informational for upgrades; this was a fresh install, so the install picked
  up the current scopes directly.

## Install — SUCCESS (on second attempt)

- Command: `forge install --site context-triage-dev.atlassian.net -p Jira -e development
  --confirm-scopes --non-interactive`
  (plain `forge install --site ...` prompts for the product, which fails in non-TTY).
- First attempt FAILED with a generic error: "An unexpected error occurred ... request ID:
  `4e1fbb6f02c247019c4e9ba53bff1ef1`" — "Failed to install into the following Atlassian apps:
  Jira. Run forge install again to reattempt this installation."
- Retry with `--verbose` SUCCEEDED. Install task `f5d9f7ad-3d26-4cc2-926a-2a74df7c135d` went
  RUNNING → COMPLETE. Output: "✔ Install in Jira complete! Your app in the development
  environment is now installed in Jira on context-triage-dev.atlassian.net."

## Verification (CLI)

`forge install list` output:

| Installation ID | Environment | Installed in | Connected to | Version | Status |
|---|---|---|---|---|---|
| 8d504b95-5afb-4a2a-9470-b0f06826be63 | development | Site | context-triage-dev.atlassian.net: Jira | 2 | Up-to-date |

- App enforcement metadata (from the install verbose log): developerSpaceId
  `19523bb4-92cc-47ae-ac3b-be53f232dc3c`, ccpEntitlementId present; site is Jira **Free** edition;
  installed version 2.0.0 with scopes `read:jira-work`, `read:jira-user`.

## Installation link

Forge apps have no separate public installation URL — the app surfaces inside Jira (the
"Context Triage" issue panel on issues, and the "Triage Assistant" Rovo agent). The canonical
links are:

- Jira site (app installed here): https://context-triage-dev.atlassian.net/
- Developer console overview: https://developer.atlassian.com/console/myapps/c56add27-5527-4f0b-882a-01b86c199e1a/overview
- Installations in the console: https://developer.atlassian.com/console/myapps/c56add27-5527-4f0b-882a-01b86c199e1a/monitoring/installations

**Still owed (needs a browser-capable agent):** open the Jira site, open an issue, and confirm
the Context Triage panel renders; confirm the Triage Assistant appears in the Rovo agent list.
This subagent could not do browser verification.

## What succeeded earlier (unchanged)

- Connector scaffolded: `~/workspace/custom-connectors/custom.atlassian/` with `CONNECTOR.md`,
  `connector.yaml`, and helper `bin/atlassian.py` (compiled with `python3 -m py_compile`).
- Helper verified working as a program: it retrieves the `hsurr:` surrogate from authd for
  `custom.atlassian` and makes outbound requests to registered hosts.
- Forge usage-analytics set to `false` in the isolated config (`XDG_CONFIG_HOME=/tmp/forge-config`).
- App tests pass: 16/16, 0 fail (`node --test test/triage.test.js`, in `context-triage/`).
- Atlassian site exists and is Jira Free, no card: https://context-triage-dev.atlassian.net/

## Root cause of the earlier login block (verified against Forge source, now resolved)

- Forge CLI sends the API token as HTTP Basic auth. Its `PersonalTokenAuthenticator` calls
  `getBasicAuthorizationHeader(email, token)`, which returns `Basic base64("email:token")`.
  Source: `/usr/lib/node_modules/@forge/cli/node_modules/@forge/cli-shared/out/auth/personal/token-authenticator.js`
  and `out/auth/authenticator.js`.
- The Vault surrogate only works when the literal `hsurr:` string appears in an approved outbound
  HTTP request, so the runtime can swap it for the real token. Base64 encoding hides the literal
  string, so no swap happens. Atlassian receives the literal surrogate as the password and rejects it.
- The connector was registered with placement `bearer_header`, but Atlassian API tokens authenticate
  only through Basic auth. The connector system offers no Basic auth placement, so no registered
  placement can express Atlassian API token auth. Direct REST calls through the connector cannot
  authenticate either.
- The parent resolved this outside this run by completing `forge login` directly (credential now in
  the Forge config at `/tmp/forge-config`). No token value was written in chat, in a file, or in a log
  by this subagent.

## Files

- Connector doc: `~/workspace/custom-connectors/custom.atlassian/CONNECTOR.md`
- Helper: `~/workspace/custom-connectors/custom.atlassian/bin/atlassian.py`
- App: `~/workspace/hackathons/codegeist-2026/context-triage/` (manifest.yml now carries the real app id)
- Expect driver used for the Developer Space prompt: `/tmp/forge-register.exp` (ephemeral; log at `/tmp/forge-register.log`)
- This report: `~/workspace/hackathons/codegeist-2026/forge-deploy-report-2026-11-24.md`
