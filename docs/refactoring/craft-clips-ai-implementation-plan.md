---
name: Craft Clips AI rebuild
overview: Craft Clips revamp with action cards, settings, AI Formatted OR AI Refactoring, archive dedupe, CRUD categories.
status: implemented
primary_file: extension/popup/features/ai-lab/ai-lab.magic.js
---

# Craft Clips AI Implementation Plan

## Shipped (May 2026)

| Area | Location |
|---|---|
| Entry | `#magicWand` → `magicFormat()` — **Craft Clips** modal |
| Settings | `ai-lab.craft-clips.settings.js`, key `pc_craft_clips_settings_v1` |
| Action cards | `_buildCraftClipActions` in `ai-lab.magic.js` |
| AI Formatted | `ai-format` — updates `clip.text` |
| AI Refactoring | `ai-refactor` Edge + `pasteCraftSupabase.aiRefactor` — `refactoredText`, `refactorLevel`, `refactoredAt` |
| Categorize | Toggle + `ai-categorize`; new categories via `createCategory` CRUD |
| Dedupe | Toggle archives younger dupes to `searchOnlyClips` |
| Undo | Snapshot includes `searchOnlyClips` (craft selected + craft all) |

## Verification checklist

- [x] Craft Clips label in popup
- [x] Action cards reflect settings before run
- [x] One AI mode per craft (Formatted OR Refactoring)
- [x] Duplicate toggle archives with undo
- [x] Categories via `createCategory` (not inline random push)
- [ ] CodeScene review on `ai-lab.magic.js` (run before commit)
- [ ] Deploy `supabase/functions/ai-refactor` to project

## Follow-up

- Supabase `clips` columns for `refactored_text` if cross-device refactor sync needed
- Optional DOM id rename `magic*` → `craftClip*`
