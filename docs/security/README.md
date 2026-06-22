# Security documentation

Operational security playbooks and vulnerability assessments are **local-only** on your dev machine (`local/security/`). They are listed in `.gitignore` and must not be pushed to GitHub.

For production extension rules, see `.cursor/rules/production-publishing-safety.mdc` (store/update safety only — no exploit detail).

**Important:** If this repo was ever public on GitHub with the old vulnerability docs, they may still exist in **git history**. Removing them from the latest commit does not erase past pushes. Consider making the repo private or running history cleanup if those files were previously exposed.
