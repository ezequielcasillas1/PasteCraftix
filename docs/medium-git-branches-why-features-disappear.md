# Why Your Feature “Disappeared” After You Merged It (And How Git Branches Actually Work)

**Subtitle:** A practical guide for solo developers and small teams who keep losing work they thought was already shipped.

---

You merged the feature. You pushed it. You celebrated.

Then you switched branches to review a pull request, reloaded your app, and the feature was gone.

If that sounds familiar, you are not bad at Git. You are missing one idea that almost nobody explains clearly:

> **Merging into `main` is permanent for `main`. It is not automatic for every other branch.**

This article walks through a fictional example so you can stop losing features without exposing any real project internals.

---

## The story (fictional, but painfully real)

Imagine you are building **TaskFlow**, a browser extension with a floating toolbar.

One week you add a new **Quick Capture** button to the toolbar. It works beautifully on your feature branch:

```bash
feat/quick-capture
```

You commit, push, open a pull request, merge into `main`, and close the ticket. Done, right?

A few days later you checkout an older branch to review a refactor:

```bash
git checkout refactor/settings-cleanup
```

You reload the extension. The Quick Capture button is missing.

Panic sets in. Did the merge fail? Did someone delete your code? Did GitHub lie to you?

No. Your code is still on `main`. You are simply running a **different snapshot** of the project.

---

## Branches are snapshots, not shared folders

Think of each branch as a parallel copy of your project frozen at a point in time.

```
main
  │
  ├── feat/quick-capture   (where you built the feature)
  │
  └── refactor/settings-cleanup   (created before the merge)
```

When you run:

```bash
git checkout refactor/settings-cleanup
```

Git replaces the files on your machine with whatever existed on that branch **when it was created or last updated**.

If `refactor/settings-cleanup` was branched off `main` *before* Quick Capture merged, that branch literally does not contain Quick Capture. Git is doing exactly what you asked.

Your browser does not know about branches. It loads whatever files are on disk right now.

---

## Commit, push, merge: three different verbs

Most confusion comes from treating these as the same action.

| Action | What it does | Does it update `main`? |
|---|---|---|
| `git commit` | Saves a snapshot on your **current** branch | No |
| `git push` | Uploads your **current** branch to the remote | No |
| Merge (or merge PR) | Copies changes **into** a target branch | Only the branch you merge into |

**Push is not merge.**

Pushing `feat/quick-capture` puts your feature on GitHub. It does not put it on `main` until you merge.

Once merged, Quick Capture lives on `main` forever — unless someone removes it in a later commit.

---

## A timeline that causes the “disappearing feature” bug

Here is the exact sequence that trips people up:

1. `main` is at commit **A**
2. You create `refactor/settings-cleanup` from **A**
3. You build Quick Capture on `feat/quick-capture`
4. You merge Quick Capture into `main` → `main` is now at **B**
5. You checkout `refactor/settings-cleanup` → still stuck at **A**

Quick Capture exists on **B** (`main`).  
`refactor/settings-cleanup` never received **B**.

So the feature did not disappear. You left the branch that has it.

---

## The one command to check before you test anything

Before you reload your app, run:

```bash
git branch --show-current
```

If the answer is not `main`, ask a second question:

> Was this branch created before or after my feature merged?

If **before**, you need to bring `main` into that branch.

---

## How to keep a merged feature on the branch you are testing

You have two good options.

### Option 1: Merge `main` into your branch (safest for beginners)

```bash
git checkout refactor/settings-cleanup
git pull origin main
```

Now your refactor branch contains Quick Capture **and** your refactor work.

### Option 2: Rebase onto `main` (cleaner history, slightly sharper edges)

```bash
git checkout refactor/settings-cleanup
git rebase main
```

This replays your refactor commits on top of the latest `main`. Great for PR hygiene. Use it once you are comfortable resolving conflicts.

---

## A simple rule for solo developers

> **Every time you start testing on a branch that is not `main`, ask: “Does this branch include the latest `main`?”**

If not:

```bash
git pull origin main
```

That single habit prevents 80% of “my feature vanished” moments.

---

## How to verify a feature exists on your current branch

Do not trust your memory. Check the filesystem Git is giving you.

Example — you expect a module called `toolbar.capture.js`:

```bash
git ls-files src/toolbar.capture.js
```

- **File path returned** → feature exists on this branch
- **Nothing returned** → this branch does not have it yet

You can also skim recent history:

```bash
git log --oneline -10
```

Look for your merge commit or feature commit. If it is missing, you are on an older line of history.

---

## Common myths, debunked

### “I merged it, so it should be everywhere.”

No. Merge is **targeted**. It updates the branch you merge **into**, not every branch in the repo.

### “I pushed it, so it is live on main.”

Push uploads a branch. `main` only changes when something merges **into** `main`.

### “GitHub has it, so my local folder should too.”

Only after you `git pull` the branch that contains it **and** you are checked out on that branch (or a branch that has merged it).

### “The feature was deleted.”

Usually it was not. You are on a branch that predates the merge. Less dramatic. More fixable.

---

## A pre-flight checklist before you test in the browser

1. `git branch --show-current`
2. If not on `main`: `git pull origin main`
3. Confirm the feature file exists: `git ls-files path/to/feature`
4. Reload your app / extension
5. If still missing, check you are loading the correct build folder

---

## What “forever” actually means in Git

When you merge a feature into `main`:

- It stays on `main` until a future commit removes it
- It does **not** automatically appear on branches created earlier
- It **does** automatically appear on branches created **after** that merge

So “forever” means **forever on `main`**, not **forever on every branch by default**.

That distinction is the whole game.

---

## Closing thought

Git does not hide your work. It shows you exactly which snapshot you asked to see.

The feature did not ghost you. You switched timelines.

Learn that, and Git stops feeling like a haunted house and starts feeling like a filing system you can trust.

---

## Quick reference card

```bash
# Where am I?
git branch --show-current

# Go to stable branch
git checkout main
git pull origin main

# Update my feature branch with latest main
git checkout my-branch
git pull origin main

# Does this branch have my file?
git ls-files path/to/my-feature.js
```

---

*If this helped, share it with a teammate who recently said “I swear I already merged that.” They are not alone.*

---

**Tags (for Medium):** Git, Software Development, Web Development, Developer Tools, Programming Tips, Beginner Git, Version Control

**Suggested Medium title:** Why Your Feature Disappeared After You Merged It (Git Branches Explained Simply)
