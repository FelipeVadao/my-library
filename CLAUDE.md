@AGENTS.md
@FIGMA.md

## Workflow: clean up on every update

Whenever you push an update to this project (a feature, fix, or refactor that
gets committed and deployed), treat removing what's no longer needed as part
of that update, not a separate cleanup pass:
- Code/components/files made obsolete by the change (old implementation left
  behind after a rewrite, components no longer imported anywhere, dead
  branches from a replaced feature).
- Scratch artifacts from the work itself (debug screenshots, one-off SQL
  scripts superseded by `supabase/schema.sql`, browser-automation logs) living
  outside the repo in the parent `My_Library` folder.

Before deleting anything outside the git repo (nothing to `git revert` if
wrong), list what you intend to remove and why superseded/unused, same as the
cleanup done before the 2026-07-04 dark-vintage theme deploy. Files tracked
in git are lower-risk since history preserves them — still call out non-trivial
deletions rather than silently dropping them in a commit.
