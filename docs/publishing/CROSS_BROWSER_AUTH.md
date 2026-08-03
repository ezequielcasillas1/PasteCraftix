# Cross-Browser OAuth Redirect URLs (Chrome + Edge)

PasteCraft ships the same `extension/` package to Chrome Web Store and Edge Add-ons. The two stores assign DIFFERENT extension IDs, which means each browser produces a different `chromiumapp.org` redirect URL. Both must be on Supabase's allowlist or OAuth fails on that browser.

## 1. Find each extension ID

**Chrome Web Store**
- Dashboard: https://chrome.google.com/webstore/devconsole
- Open the PasteCraft listing → the ID appears in the URL and on the "Package" tab
- Or load unpacked in Chrome at `chrome://extensions` with Developer Mode on

**Edge Add-ons**
- Dashboard: https://partner.microsoft.com/dashboard/microsoftedge/
- Open the PasteCraft listing → the ID appears in the URL and on the overview page
- Or load unpacked in Edge at `edge://extensions` with Developer Mode on

## 2. Add both to Supabase

Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → add BOTH:

```
https://fidljmdohgkjmmgojdblbbnfoeengoko.chromiumapp.org/
https://fblihhfoojjhmhnhilhhejdcigjmmncc.chromiumapp.org/
```

| Store | Extension ID |
|---|---|
| Chrome Web Store | `fidljmdohgkjmmgojdblbbnfoeengoko` |
| Edge Add-ons | `fblihhfoojjhmhnhilhhejdcigjmmncc` |

Save. Changes take effect immediately.

## 3. Verify

1. Chrome: sign out, click "Sign in with Google" in the extension → OAuth completes, session restored
2. Edge: sign out, click "Sign in with Google" → OAuth completes, session restored
3. If either fails with a redirect error, the missing URL is not on the Supabase allowlist

## 4. Re-verify triggers

Re-check this list if:
- Either store ever re-issues an extension ID (rare, but possible after listing changes)
- You create a new listing (which you should NEVER do — see `.cursor/rules/production-publishing-safety.mdc` Section A)
- You change Supabase project / region

## Related

- `.cursor/rules/production-publishing-safety.mdc` — Sections A, F, J
- `[extension/supabase-client.js](../../extension/supabase-client.js)` — `launchWebAuthFlow` call site
