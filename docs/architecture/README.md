# Architecture docs

- **[FORWARD-ARCHITECTURE.md](./FORWARD-ARCHITECTURE.md)** — Canonical cutoff (2026-07-05): Modular Vertical Slices + Legacy Facades, bridge rules, strangler migration, Arkitect intake.
- **Related:** `.cursor/rules/arkitect-mcp-paved-route.mdc`, `.cursor/rules/forward-architecture.mdc`, `.cursor/rules/premium-ui-phases.mdc`, `.cursor/rules/vertical-slice-modularity.mdc`, `docs/refactoring/refactor-plan-composer-first.md`.

## Persistence note

These files must live on **`main`**, not only on task branches (`docs/restore-forward-architecture`, `docs/forward-architecture-and-merchant`). Restoring on a branch without merging to `main` makes the docs look deleted when you checkout or pull `main`. Merge or cherry-pick to `main` after any restore.
