---
name: AI Lab modular refactor
overview: Extract AI Lab feature from popup.js into focused modules. Model assignments per slice based on CodeScene CC scores.
status: planned
primary_file: extension/popup.js
codescene_score: 1.09
---

# AI Lab Modular Refactor Plan

## Goal

Extract all AI Lab logic from `extension/popup.js` into `extension/popup/features/ai-lab/` modules. Behavior stays unchanged. CodeScene is the quality gate before every commit.

## CodeScene Baseline (AI Lab functions in popup.js)

| Function | CC | Lines | Risk |
|---|---|---|---|
| `_craftMagic` | 63 | 5806–5971 | Brain Method |
| `continueHistoryConversation` | 38 | 11201–11328 | Brain Method |
| `_computeAiImageCreditsView` | 29 | 1296–1350 | Complex |
| `_computeAiTextCreditsView` | 25 | 1352–1400 | Complex |
| `renderAiHistoryList` | 24 | 10966–11042 | Complex |
| `_enhanceContent` | 24 | 5528–5578 | Complex |
| `_wireBulkAiButtons` | 20 | 5411–5462 | Complex |
| `saveAiHistory` | 19 | 10870–10937 | Complex |
| `saveAiWorkflowFromUi` | 19 | 875–940 | Complex |
| `_analyzeMagicClips` | 19 | 5592–5638 | Complex |
| `generateBreakdownInline` | 17 | 6752–6818 | Complex |
| `_renderAiResponse` | 14 | 7085–7167 | Moderate |
| `handleBreakdownFollowup` | 14 | 7192–7277 | Moderate |
| `_detectContentType` | 14 | 5466–5489 | Moderate |
| `_renderMagicPagination` | 13 | 5739–5778 | Moderate |
| `updateAiCreditsPills` | 12 | 1432–1460 | Moderate |
| `sendInlineBreakdownFollowup` | 12 | 6820–6871 | Moderate |
| `openAiHistoryModal` | 11 | 11045–11081 | Threshold |
| `generateSummary` | 11 | 6978–7043 | Threshold |
| `_hasAiAccess` | 11 | 5789–5798 | Threshold |
| `_normalizeAiWorkflow` | 11 | 795–807 | Threshold |
| `loadAiWorkflow` | 11 | 809–842 | Threshold |
| `applyAiWorkflowToUi` | 11 | 844–873 | Threshold |
| `showSummarySection` | 10 | 6902–6920 | Safe |
| `generateSummaryQuestions` | 9 | 6922–6976 | Safe |

## Model Assignment Strategy

- **GPT-5.5 medium** — slices where all functions have CC ≤ 25 (constants, selectors, credits, summary, history scaffolding, controller)
- **Opus 4.7 xhigh thinking** — slices containing `_craftMagic` (CC=63), `continueHistoryConversation` (CC=38), and their supporting decomposition helpers

This splits ~70% of the work to GPT-5.5 (cheaper) and reserves Opus 4.7 for the two brain-method functions.

## Target Folder Shape

```
extension/popup/features/ai-lab/
  ai-lab.constants.js
  ai-lab.selectors.js
  ai-lab.credits.js
  ai-lab.summary.js
  ai-lab.history.js
  ai-lab.magic.js
  ai-lab.controller.js
```

## Dependency Map

```
Feature: AI Lab
State: aiHistory, aiTab, aiWorkflow, imageCredits, textCredits, summaryState
DOM: aiLabTab, aiHistoryList, aiSummaryPanel, magicPanel, creditsPills, breakdownPanel
Storage: ai_history, ai_workflow, ai_credits
External: supabase (AI generation calls), popup.js (app context)
Modules needed: constants, selectors, credits, summary, history, magic, controller
```

## Slice Breakdown

---

### Slice 1 — ai-lab.constants.js + ai-lab.selectors.js
**Model: GPT-5.5 medium**
**CC risk: None (no logic)**

Extract:
- All AI Lab storage key constants (ai_history, ai_workflow, etc.)
- All tab/panel/button ID string constants
- All DOM selector helpers for AI Lab elements

Gate: CodeScene pre-commit — verdict must be `unchanged` or `improved` on both files.

---

### Slice 2 — ai-lab.credits.js
**Model: GPT-5.5 medium**
**CC risk: Medium (max CC=29)**

Extract:
- `_normalizeAiWorkflow` (cc=11)
- `loadAiWorkflow` (cc=11)
- `applyAiWorkflowToUi` (cc=11)
- `saveAiWorkflowFromUi` (cc=19)
- `updateAiCreditsPills` (cc=12)
- `_computeAiImageCreditsView` (cc=29)
- `_computeAiTextCreditsView` (cc=25)

If `_computeAiImageCreditsView` or `_computeAiTextCreditsView` fail the CodeScene gate (CC > 9 threshold), GPT-5.5 must sub-refactor them inline before commit. If GPT-5.5 cannot reduce cleanly, escalate that function only to Opus 4.7.

Gate: CodeScene pre-commit on `ai-lab.credits.js` — no function CC > 9.

---

### Slice 3 — ai-lab.summary.js
**Model: GPT-5.5 medium**
**CC risk: Low-Medium (max CC=17)**

Extract:
- `showSummarySection` (cc=10)
- `generateSummaryQuestions` (cc=9)
- `generateSummary` (cc=11)
- `_renderAiResponse` (cc=14)
- `handleBreakdownFollowup` (cc=14)
- `generateBreakdownInline` (cc=17)
- `sendInlineBreakdownFollowup` (cc=12)
- `renderInlineBreakdownPagination`
- `_hasAiAccess` (cc=11)
- `_formatAiOutput`
- `formatClipViewerPlainText` (cc=12)

Gate: CodeScene pre-commit on `ai-lab.summary.js` — no function CC > 9.

---

### Slice 4 — ai-lab.history.js (scaffold only — no `continueHistoryConversation`)
**Model: GPT-5.5 medium**
**CC risk: Medium (max CC=24, excluding cc=38 function)**

Extract:
- `loadAiHistory`
- `_persistAiHistory`
- `saveAiHistory` (cc=19)
- `_generateAiHistoryTitle`
- `renderAiHistoryList` (cc=24)
- `openAiHistoryModal` (cc=11)
- `clearAllAiHistory`
- `navigateHistoryThread`
- `_startEditHistoryTitle`
- `getActivitySummary`
- `fetchActivityPage`

**Do NOT extract `continueHistoryConversation` in this slice** — that is Slice 6 (Opus 4.7).
Leave a stub `continueHistoryConversation` call delegating to `popup.js` temporarily.

Gate: CodeScene pre-commit on `ai-lab.history.js` — no function CC > 9.

---

### Slice 5 — ai-lab.magic.js (BRAIN METHOD SLICE)
**Model: Opus 4.7 xhigh thinking — mandatory**
**CC risk: CRITICAL (`_craftMagic` cc=63)**

Extract:
- `_craftMagic` (cc=63) — must be decomposed into private helpers until each helper CC ≤ 9
- `_wireBulkAiButtons` (cc=20)
- `_detectContentType` (cc=14)
- `_enhanceContent` (cc=24)
- `_analyzeMagicClips` (cc=19)
- `_skipAiFormatTypes`
- `magicFormat`
- `_renderMagicPage` (cc=9)
- `_renderMagicPagination` (cc=13)
- `updatePreview` (cc=12)

Opus 4.7 must sub-refactor `_craftMagic` inline — break into private `_craftMagic*` helpers until CodeScene reports no CC > 9 finding on this file.

Gate: CodeScene pre-commit on `ai-lab.magic.js` — verdict must be `unchanged` or `improved`, no `_craftMagic` in findings.

---

### Slice 6 — ai-lab.history.js deep (BRAIN METHOD SLICE)
**Model: Opus 4.7 xhigh thinking — mandatory**
**CC risk: HIGH (`continueHistoryConversation` cc=38)**

Extract into `ai-lab.history.js`:
- `continueHistoryConversation` (cc=38) — must be decomposed into private helpers until CC ≤ 9

Remove the temporary stub from Slice 4 and replace with the real implementation.

Gate: CodeScene pre-commit on `ai-lab.history.js` — no function CC > 9.

---

### Slice 7 — ai-lab.controller.js
**Model: GPT-5.5 medium**
**CC risk: None (wiring only)**

Create `ai-lab.controller.js`:
- `initAiLabFeature(app)` — imports and wires all 5 modules
- Returns `{ credits, summary, history, magic }` adapter object
- Update `popup.js` to delegate all AI Lab method calls to `this.aiLabFeature.*`

Gate: CodeScene pre-commit on `popup.js` — overall score must improve from 1.09.

---

## Refactor Rules (inherited from clips-first-modular-refactor-plan.md)

- Move one responsibility at a time.
- After each slice, the popup must load and AI Lab must still work.
- Do not rewrite behavior — move code only.
- Keep each slice small enough to review and revert safely.
- Run CodeScene pre-commit gate before every commit.

## Manual Test Checklist (run after each slice)

- Popup opens without console errors.
- AI Lab tab opens and renders.
- Credits pills display correctly.
- AI workflow loads and saves.
- Summary generation works on a clip.
- Breakdown inline renders.
- Magic auto-categorize runs on selected clips.
- AI history loads, renders, and saves.
- Continue conversation from history works.
- Clear all history clears the list.

## Global Bridge Contract (keep stable)

- `window.pasteCraftPopup`
- `PasteCraftPopup.handleMessage()`
- All AI Lab delegated method names on `PasteCraftPopup` must stay until controller is wired

## Done Criteria

- All AI Lab methods delegated to `this.aiLabFeature.*` in `popup.js`.
- CodeScene score on `popup.js` improves above 1.09.
- All 7 new ai-lab modules pass CodeScene gate (no CC > 9 per function).
- AI Lab manual test checklist passes.
- No storage keys renamed, no Supabase schema changed.
