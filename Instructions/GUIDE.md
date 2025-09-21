# Cursor.ai Project Guidelines (for PasteCraft)
The UI for every new addon or feature must be built with beautiful, professional, and modern design. Each element should have eye-catching styling, such as vibrant gradients, smooth animations, polished typography, and intuitive layouts that immediately attract users and encourage interaction. Every label, button, or mode must have a clear and descriptive name so users instantly understand what the feature does. Consistency, elegance, and engagement should be prioritized across all UI content, ensuring that every addon feels like a refined, high-quality product experience.

> **Purpose:** Give Cursor (and any connected AI agents) a single source of truth for how to contribute to this repo without breaking critical pieces, while still allowing tasteful UI innovation inspired by **bolt.new** patterns.

---

## 🔒 Non‑Negotiables (Hard Rules)

These are absolute. Cursor/agents **MUST** obey them at all times.

1. **NEVER delete or reset the database.**

   * Do not drop tables, truncate, or auto‑migrate destructively.
   * Migrations must be **additive** and backwards compatible.
2. **NEVER delete, rotate, or expose API keys & secrets.**

   * Do not write secrets to logs, PRs, screenshots, or comments.
   * Only read from environment variables (e.g., `.env`, project secrets). No hard‑coding.
3. **NEVER remove existing UI elements unless explicitly instructed.**

   * Preserve current layouts, components, and routes. Add new components **adjacent** to existing ones.
4. **ONLY build the features requested in the prompt.**

   * No out‑of‑scope endpoints, pages, models, or libraries.
   * If a dependency is required, explain why in a short note.
5. **Do not change pricing, terms, or user‑facing legal text** without explicit instruction.
6. **Respect performance & accessibility baselines.**

   * Lighthouse A11y ≥ 90; no blocking main thread > 200ms per interaction.

If any task creates conflict with the above, **pause and generate a short “Approval Needed” note** listing the conflict and proposed alternatives.

---

## 🎨 Allowed Creative Freedom (Guided)

Cursor can innovate in **visual design** and **layout** when all of the following are true:

* The innovation is **clearly derived from the prompt** (no feature creep).
* The change is **additive** (does not remove working UI).
* Provide a **preview gate** (e.g., feature flag, draft route, or WIP component) so we can review before it ships.
* Follow **bolt.new‑style** heuristics:

  * Clean, minimal UI, strong hierarchy, meaningful whitespace.
  * Card‑based sections, grid layouts, rounded corners, soft shadows.
  * Clear primary CTA, neutral secondary actions.
  * Sensible empty states and skeleton loaders.

> If in doubt, output a quick **Design Note** (1–3 bullets + a wireframe snippet in code) before implementing.

---

## 🧭 Current App Features ( Snapshot )

> Keep this list updated. When adding/editing, **append**—do not delete—previous entries; mark deprecated items.

* **Memorization Results & Syntax Highlighting**

  * Highlights: **missed**, **extra**, and **incorrect** words.
  * Goal: train users to recall exact wording.
* **Syntax Lab (Training Mode)**

  * A focused space to practice weak spots surfaced by results.
  * Adjustable difficulty / repeat intervals (WIP).
* **Verse Generator & Search**

  * Supports public‑domain translations for generation.
  * Engine: integrates with Bible text sources for fetch & query.
* **Translation Feature (Google Cloud Translate)**

  * Translates full verses, not partial snippets (ensure end‑to‑end verse coverage).
  * UI shows source translation + target with copy/share actions.
* **Commission / Missions Feature (Curated Verses)**

  * Surfaces verses oriented to calling, purpose, and outreach (content rules apply).

*If running locally, see `.env.example` for required variables; never commit real values.*

---

## ✅ Definition of Done (Per Task)

A task is **done** only when:

* All **Non‑Negotiables** pass.
* Unit tests added/updated for new logic.
* Types are strict; no `any` where avoidable.
* **No regressions** in existing flows (smoke test: memorize → results → syntax lab → translate).
* Added a 3–5 line **Task Note** summarizing scope & decisions.

---

## 🔐 Secrets & Environment

* Read secrets **only** from environment (e.g., `process.env.*`).
* Do not print secrets in logs or UI.
* Provide an updated `.env.example` whenever new vars are introduced.
* If a key is missing, fail gracefully with a helpful message.

```env
# Example (do not commit real values)
GOOGLE_PROJECT_ID=
GOOGLE_TRANSLATE_API_KEY=
BIBLE_API_BASE_URL=
PUBLIC_SITE_URL=
```

---

## 🗄️ Data & Migrations

* Use **non‑destructive** migrations (columns additive, null‑safe defaults).
* Never drop, rename, or repurpose columns without explicit approval & data migration plan.
* Add a migration **comment** explaining purpose and rollback.

---

## 🧱 Architecture & Code Style

* Keep components **small** and **pure**; container/presentational split where appropriate.
* Prefer **server actions / API routes** with input validation (e.g., Zod).
* Error boundaries on page‑level routes.
* Use **feature folders**: `features/<area>/{components,hooks,api}`.
* Naming: descriptive, no abbreviations that hide intent.

---

## 🧪 Testing

* Unit tests for pure logic and formatters.
* Integration tests for API endpoints.
* Minimal e2e smoke for the core flow (memorize → results → syntax lab → translation).

---

## 🧰 Workflow for Cursor / Agents

1. **Read the prompt** and map it to a **single, minimal PR**.
2. **Plan**

   * List impacted files, data, routes.
   * List risks relative to Non‑Negotiables.
3. **Implement additively**

   * New components live beside existing ones.
   * Feature‑flag or route under `/labs/*` when UI is experimental.
4. **Validate**

   * Run lint/tests; verify no UI removal.
   * Confirm translations still return **full verses**.
5. **Summarize** in a Task Note and request review.

> If the prompt is ambiguous, generate a **Questions** section (max 5 bullets) and stop.

---

## 🧯 Guardrails & Safety Checks

* Protected paths (never delete/rename):

  * `db/**`, `prisma/**` or `supabase/**` schemas
  * `app/(core)/**` routes
  * `.env*`, CI workflows, analytics configs
* Before running migrations: create a **backup** or export schema.
* Add **rate limiting** to any new public endpoint.
* No new analytics or trackers without consent banner hooks.

---

## 🧩 UI Guidelines (bolt.new‑inspired)

* Modern, minimalist, readable; prefer Tailwind utility clarity.
* Cards with 2xl radius, soft shadow, generous padding.
* Clear H1/H2/H3 hierarchy; avoid clutter.
* Loading skeletons and empty states are **required**.
* Keep color usage restrained; semantic tokens for states.

**Components to reuse:**

* Result chips (missed/extra/incorrect)
* Verse block with reference + copy
* Translation callout with source/target tabs

---

## 📄 PR Template (Cursor should auto‑include)

```md
### Summary
What changed and why.

### Scope
- Pages/Routes:
- Components:
- API/Server:
- Data/Migrations:

### Safety
- [ ] No secrets logged
- [ ] No UI elements removed
- [ ] No destructive schema changes

### Tests
- [ ] Unit
- [ ] Integration
- [ ] e2e smoke

### Notes
- Assumptions, trade‑offs, or design nits.
```

---

## 📝 Prompt Snippets (Copy/Paste for Tasks)

* **Additive Feature**

  > Build a new **\[feature name]** as an additive component under `features/[area]`. Do **not** remove or refactor existing components. Use a preview route `/labs/[feature]`. Follow the Non‑Negotiables and add a Task Note.

* **UI Innovation (Guarded)**

  > Propose up to **two** layout variations inspired by **bolt.new**. Implement the chosen variant under `/labs/ui‑trial‑A` with a feature flag. Do not alter production routes.

* **Bug Fix (No Scope Creep)**

  > Fix **\[bug]** only. No unrelated refactors. Add/adjust tests for this case. Include a 3‑line summary.

---

## 📌 Maintenance

* Keep this file in the repo root as `CURSOR_GUIDELINES.md`.
* Update the **Current App Features** section when new features land.
* Treat edits to **Non‑Negotiables** as governance; require explicit approval.

---

## ✅ Quick Checklist for Every Change

* [ ] Non‑Negotiables satisfied
* [ ] Additive only; nothing removed
* [ ] Secrets safe; env documented
* [ ] Tests updated; core flow intact
* [ ] Task Note added; PR template filled

---

**Contact:** For clarifications, open an issue titled `Guidelines: Question – <topic>` and assign to the maintainer.
