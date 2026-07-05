# PasteCraft maintenance watchlist — Cursor Automation

Field-by-field copy blocks: [AUTOMATION-FIELDS.md](./AUTOMATION-FIELDS.md)

Manual setup when agent `open_automation` prefill does not land in the Glass editor.

## Create in Cursor UI

1. Open **Automations** (Glass panel or [cursor.com/automations](https://cursor.com/automations)) → **New automation**.
2. **Name:** `PasteCraft maintenance watchlist check`
3. **Description:** Biweekly web scan for MV3, Supabase, Stripe, stores, OAuth. Reports ACTION NEEDED vs ALL CLEAR.
4. **Trigger:** Schedule → **Custom cron** → `0 9 1,15 * *` (9:00 AM on the 1st and 15th — ~every two weeks).
5. **Repo:** `ezequielcasillas1/PasteCraftix`, branch `main`.
6. **Instructions:** Copy all text from [automation-prompt.txt](./automation-prompt.txt) into the agent prompt field.
7. **Compute:** Enable **Cloud Agent** for scheduled runs.
8. **Save** the automation (required — prefill alone does not persist).

## Optional

- Add **Post to Slack** (or email) in the editor if you want push notifications beyond run output in Cursor.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Editor opens empty | Glass Automations panel must be visible before agent handoff; use manual steps above. |
| "Configure trigger" blocks save | Cron must be set in UI: Schedule → custom `0 9 1,15 * *`. |
| Prefill reported success but nothing changed | MCP success only means Glass received data — you still must **Save**. |
| Scheduled run does nothing | Confirm Cloud Agent compute is on and automation is saved (not draft). |

## Related

- [PLATFORM-MAINTENANCE-WATCHLIST.md](./PLATFORM-MAINTENANCE-WATCHLIST.md) — maintenance scope the agent cross-checks
- [MV3-UPGRADE-PREPAREDNESS.md](./MV3-UPGRADE-PREPAREDNESS.md) — MV3-specific compliance
