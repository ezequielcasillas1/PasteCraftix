# Craft Clips AI Implementation Plan

## Goal

Rebuild the current Magic Complete / Magic Clips experience into a clearer Craft Clips flow that uses AI to meaningfully analyze, improve, format, categorize, and deduplicate clips.

## Current Problem

- Category naming is too shallow: a probability/statistics note can become `Note` instead of a useful category like `Probability & Statistics`.
- The four result cards currently feel inactive except for categorization.
- Users need settings that control which AI actions run.
- Enhanced AI and AI Formatted mode should be mutually exclusive.

## Page Naming

Preferred name: `Craft Clips`

Open naming options:
- `Craft Clips`
- `PasteCraft`
- `Craft Foot Clips`

## AI Category Requirements

- Analyze all selected clips/notes together before creating categories.
- Generate semantic category names based on subject, intent, and recurring themes.
- Avoid generic names like `Note`, `Text`, `Misc`, or `Content` unless no useful topic exists.
- Prefer category labels that are short, readable, and specific.
- Example: probability/statistics content should produce `Probability & Statistics`, not `Note`. - not neccessarly it should produce a tag name to what p and s can stands for depending on the clip message. 

## Settings Requirements

User can enable/disable:
- AI categorization
- Duplicate detection

User must choose only one AI improvement mode:
- Enhanced AI
- AI Formatted

Rules:
- Enhanced AI and AI Formatted cannot both be enabled at the same time.
- If one is enabled, the other is disabled automatically.
- Categorization and duplicate detection can be combined with either mode.

## Mode Behavior

### AI Categorization

- Groups clips into useful categories.
- Uses aggregate analysis across all clips, not clip-by-clip generic naming.
- Shows count of categorized clips and the category names created.

### Enhanced AI

- Improves weak or low-quality wording while preserving the original meaning.
- Useful for simple cleanup, grammar, casing, clarity, and stronger phrasing.
- Should not rewrite the clip into a formal academic style.

### AI Formatted

- Rewrites and formats clips into a high-grade structured style.
- Targets polished, PhD-level formatting for notes and long-form content.
- May add headings, spacing, ordered structure, and clearer academic-style organization.

### Duplicate Detection

- Finds exact and near-duplicate clips.
- Shows duplicate count before applying changes.
- Must avoid deleting content without user confirmation.

## UI Requirements

- Rename the Magic Complete / Magic Clips surface to the chosen Craft Clips name.
- Result cards should reflect real completed actions:
  - Categorized
  - Enhanced
  - AI Formatted
  - Dupes Found
- Disabled actions should appear inactive or skipped, not falsely report `0` as if they ran.
- Show a concise summary after processing.

## Implementation Notes

- Reuse existing AI Lab / Magic Clips modules where possible.
- Keep AI actions explicit and user-controlled.
- Add settings persistence with existing settings storage patterns.
- Treat AI outputs as suggestions until the user confirms applying them.
- Keep privacy and premium-gating behavior aligned with existing AI access rules.

## Success Criteria

- Probability/statistics notes are categorized with useful topic names.
- User can configure categorization, duplicate detection, and exactly one improvement mode.
- Enhanced AI performs light improvement.
- AI Formatted performs structured, high-grade formatting.
- Result cards only show actions that actually ran.
