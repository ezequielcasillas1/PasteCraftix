# PasteCraft Premium UI — CSS Phases Roadmap

Incremental extraction of popup inline CSS into tokenized stylesheets. One tab or surface per phase where possible.

---

## Operational Phases 0–8

| Phase | Asset | Scope |
|-------|-------|-------|
| 0 | `tokens.css` | Design tokens (`--pc-*`) |
| 1 | `primitives.css` | Buttons, inputs, chips, loading |
| 2–4 | Inline `popup.html` | Header, tabs, loading overlay |
| 5 | `clips.css` | `#clipsTab` |
| 6 | `search.css` | `#searchTab` |
| 7 | `categories.css` | `#categoriesTab` |
| 8 | `ai-lab.css` | `#aiTab` |

All extracted sheets live under `extension/assets/styles/` and link after `tokens.css` + `primitives.css` in `popup.html`.

---

## Status (Jul 2026)

| Range | State |
|-------|-------|
| 0–6 | On `main` |
| 7 | `feat/phase-7-categories-tab-ui` — not merged |
| 8 | `feat/ai-lab-css-phase8` — not merged |
| 9+ | Not started (~10k inline CSS; 44 modals remain) |

---

## Phase 9+ — Backlog Slice

First work after tab extractions complete:

1. **Notes tab**
2. **Activity tab**
3. **AI History tab**
4. Then modals, settings, and auth surfaces

---

## Extended Roadmap (After Phase 9)

| Phases | Target |
|--------|--------|
| 15–24 | Popup modals |
| 25–30 | Content widgets |
| 31–32 | Merchant UI |
| 33–37 | Satellite (auth pages, website, email) |
| 38 | Cleanup — hardcoded hex purge, `styles.css` reconciliation |
| 39+ | Optional refactor |

---

## Rules Per Phase

- **CSS-only** — no behavior or markup changes unless required for selectors
- **Load order** — link new sheet after `tokens.css` and `primitives.css`
- **Tokenize** — use `--pc-*` palette (navy / sky-blue); no new hardcoded hex
- **Remove inline** — delete matching rules from `popup.html` as each sheet lands
- **One surface** — one tab or modal group per phase when feasible

---

## Naming Warning

**Merchant Phase 9+** (alt-text SEO) is unrelated to this Premium UI CSS roadmap. Do not conflate branch names or phase numbers.

---

## Next Steps

1. Merge `feat/phase-7-categories-tab-ui` and `feat/ai-lab-css-phase8`
2. Restore `premium-ui-phases.mdc` to main if missing (`.cursor/rules/`)
3. Start Phase 9+ with Notes, Activity, and AI History tabs
