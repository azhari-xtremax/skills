# Changelog

Every release of the skills is a git tag, and every tag has a section here. The GitHub Release of
a tag carries the same section. Install a release with `npx skills add buildpad-ai/skills#<tag>`
(see the [README](README.md#install)).

Versions follow these rules:

- **MAJOR** when what a Supabase project's agent reads changes in any file, when a skill is removed
  or renamed, or when the version of the "Establish the backend first" procedure changes.
- **MINOR** when a skill is added, or when text for Engine projects only changes.
- **PATCH** for anything else, such as a typo.

From `v2.0.0` on, each section has a subsection **Supabase projects** that lists every change to
what a Supabase project's agent reads, with its reason.

## v1.0.0

The Baseline_Revision: the last revision of `main` before the skills learned to serve Engine
projects (commit `7ed910f`). It is the skills exactly as Supabase projects used them until then.
Stay on it with `npx skills add buildpad-ai/skills#v1.0.0`.
