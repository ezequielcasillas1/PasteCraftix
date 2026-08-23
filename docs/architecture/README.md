# Architecture docs

- **[FORWARD-ARCHITECTURE.md](./FORWARD-ARCHITECTURE.md)** — Canonical cutoff (2026-07-05): Modular Vertical Slices + Legacy Facades, bridge rules, strangler migration, Arkitect intake.
- **[engineering-readiness-roadmap.md](./engineering-readiness-roadmap.md)** — Platform compliance, store readiness, Supabase key/ES256 phased plan, discussion tracks A/B/C.
- **[architecture-deep-reference.md](../../ArchiGuide/architecture-deep-reference.md)** — Extension + Supabase directory map and deep reference.
- **[PasteCraft-Architecture-Pack.pdf](./PasteCraft-Architecture-Pack.pdf)** — Combined PDF of the three docs above (downloadable).
- **Related:** `.cursor/rules/forward-architecture.mdc`, `.cursor/rules/vertical-slice-modularity.mdc`, `docs/refactoring/refactor-plan-composer-first.md`.

## Persistence note

These files must live on **`main`**, not only on task branches (`docs/restore-forward-architecture`, `docs/forward-architecture-and-merchant`). Restoring on a branch without merging to `main` makes the docs look deleted when you checkout or pull `main`. Merge or cherry-pick to `main` after any restore.
