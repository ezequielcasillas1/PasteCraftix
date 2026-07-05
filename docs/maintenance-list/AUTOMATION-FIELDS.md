# PasteCraft maintenance — Automations field reference

Copy each block into the matching field in the Cursor Automations editor.

## Name

```
PasteCraft maintenance watchlist check
```

## Description

```
Biweekly web scan for MV3, Supabase, Stripe, stores, and OAuth. Reports ACTION NEEDED vs ALL CLEAR.
```

## Trigger

**Type:** Schedule → Custom cron

```
0 9 1,15 * *
```

~Biweekly at 9:00 AM on the 1st and 15th of each month.

## Repository

**Owner/repo:**

```
ezequielcasillas1/PasteCraftix
```

**Branch:**

```
main
```

## Instructions / Prompt

Paste the full contents of [automation-prompt.txt](./automation-prompt.txt) into the agent instructions field. Do not shorten unless you intentionally change scope.

## Tools

Agent-only run — no repo write required. In the editor: leave write/edit tools off unless you want the agent to open PRs or edit files on ACTION NEEDED.

## Cloud Agent

Enable **Cloud Agent** compute so scheduled runs execute without a local IDE session.

## Optional: Slack

Add **Post to Slack** (or email) in the editor if you want push notifications beyond run output in Cursor.

## Save checklist

- Cron is set: `0 9 1,15 * *` (not draft / not “configure trigger”).
- Instructions field contains full [automation-prompt.txt](./automation-prompt.txt).
- Cloud Agent is on → click **Save** (prefill alone does not persist).
