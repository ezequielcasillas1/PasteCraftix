# PasteCraft Git Branch Guide
## Why Capture Tools Keep "Disappearing" and How to Stop It

---

## 1. The Simple Mental Model

A **branch** is a snapshot of your project at a point in time.

- `main` = your stable, permanent copy
- Feature/PR branches = temporary copies where new work happens
- When you `checkout` a branch, Git replaces all files on disk with that branch's snapshot

**Important:** A branch does **not** automatically contain work from another branch unless it was created from or merged with that branch.

---

## 2. The Capture Tools Story

### What happened
1. Capture Tools were built on branch `feat/region-capture-scholar`
2. The branch was committed and pushed to GitHub
3. It was **merged into `main`** via Pull Request #120
4. After the merge, `main` permanently has Capture Tools
5. But `pr-119-qp-helpers` was created **before** that merge — so it does **not** have Capture Tools
6. When you checked out `pr-119-qp-helpers`, the files on disk reverted to the older snapshot, and the hexagon disappeared

### The real rule
> **Merge into `main` is permanent for `main`. Other branches need to be updated separately.**

---

## 3. Essential Commands

### Check what branch you are on
```bash
git branch --show-current
```

### Switch to main
```bash
git checkout main
```

### Update main from GitHub
```bash
git pull origin main
```

### Merge main into your current branch
```bash
git pull origin main
```
Run this while on the branch you want to update.

### See if a branch contains Capture Tools
```bash
git log main --oneline
```
Look for `Merge pull request #120 from feat/region-capture-scholar` or `feat: widget capture tools hexagon menu with tooltip fix`.

### List capture files on the current branch
```bash
git ls-files extension/content/widget/widget.capture*
```
If this returns nothing, the branch does not have Capture Tools.

---

## 4. Branch History Visualization

```
main:  4e959c5 ── 110fd19 ── a700acb
                │            │
                │            └─ latest main (has Capture Tools)
                │
                └─ merged PR #120 (Capture Tools added here)

pr-119-qp-helpers:  4e959c5 ── 487dce0
                    │
                    └─ branched before Capture Tools merge
```

Because `pr-119-qp-helpers` started at `4e959c5` (before the merge), it has no Capture Tools unless you merge `main` into it.

---

## 5. How to Keep Capture Tools on Any Branch

If you want to test a PR branch and still see Capture Tools:

```bash
git checkout pr-119-qp-helpers
git pull origin main
```

This brings the latest `main` (including Capture Tools) into `pr-119-qp-helpers`.

### Alternative: rebase
```bash
git checkout pr-119-qp-helpers
git rebase main
```
This rewrites the branch history so it appears to start from the latest `main`.

**Note:** Only rebase if you understand the risks. `git pull origin main` is safer for beginners.

---

## 6. Before You Test in Chrome

Always check the active branch before reloading the extension:

```bash
git branch --show-current
```

| Branch | Will Capture Tools appear? |
|---|---|
| `main` | Yes, if you ran `git pull origin main` |
| Another branch | Only if that branch was merged with or rebased onto `main` after PR #120 |

If unsure, run:
```bash
git ls-files extension/content/widget/widget.capture-menu.js
```
If it returns a file path, Capture Tools exist on the current branch.

---

## 7. What Each Git Action Does

| Action | What it does | Does it put Capture Tools on `main`? |
|---|---|---|
| `git commit` | Saves changes to current branch | No — only saves to the current branch |
| `git push` | Uploads current branch to GitHub | No — uploads but does not merge |
| `git merge` | Combines another branch into current branch | Only if the source branch has Capture Tools |
| `git pull origin main` | Downloads and merges `main` into current branch | Yes, if `main` has Capture Tools |
| Pull Request (PR) | Requests a merge on GitHub | Only after PR is merged |
| Merge PR | Permanently adds changes to `main` | Yes |

---

## 8. Common Mistake

> "I merged Capture Tools. Why did they disappear?"

Because you switched to a branch that was created **before** the merge. The merge only affects the branch you merged into.

To fix: merge `main` into that branch too.

---

## 9. Quick Checklist When Something Is Missing

1. Run `git branch --show-current`
2. If not on `main`, check if the branch was created before the merge
3. Run `git log --oneline -5` to see the branch's recent commits
4. If you need the missing feature, run `git pull origin main`
5. Reload the extension in Chrome

---

## 10. Summary

- Capture Tools were merged into `main` and will stay there forever
- Other branches do not automatically get Capture Tools
- To keep a feature on every branch you test, merge `main` into each branch
- Always check `git branch --show-current` before testing in Chrome

---

Generated for PasteCraft — July 8, 2026
