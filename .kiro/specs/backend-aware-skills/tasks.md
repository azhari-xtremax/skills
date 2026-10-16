# Implementation Plan

> Phase 3 of the gated spec `backend-aware-skills`, from the approved `requirements.md` (66 live
> criteria; 1.4 and 7.6 withdrawn) and the approved `design.md`. Line numbers, ranges, row numbers
> (#), codes (BP, EF, US, NY, RW, RW+G, UC), S-sections, ES-n texts and rules R1 to R13 are the
> design's, at `origin/main` = `7ed910f`. The design's Group 0 (the baseline tag) is task 1; its
> Group 1 (infrastructure) is tasks 2 and 3; its Groups 3, 5, 6, 2 and 4 are tasks 4 to 8, in the
> design's merge order; "Last" is task 9; the external gates are task 10.
>
> **Merge order (binding).** 1, then 2+3 as one pull request, then 4, 5 and 6 in any order or in
> parallel, then 7 after 4, then 8 after 4 and 5, then 9 after every task 4 to 8. Link-move rule: the
> pull request that moves an inbound link into `supabase` text merges before, or together with, the
> pull request that file-marks its target. Every such pair below carries `_Depends:_`.
>
> **Rules for every folder sub-task (4.x to 8.x).**
> - C1. `supabase` text is the baseline text moved, never rewritten. A replaced pair is adjacent,
>   `supabase` first, with no blank line between closer and opener. A range that starts or ends in a
>   fence or a table widens to the whole fence or table. A passage closes before a heading of a
>   higher level than the one it opened under (S6).
> - C2. Every gated Markdown file carries a byte copy of `tools/repo-check/gate.md`, placed by S4.
>   Every `.ts`/`.tsx` asset with a passage or a file marker carries the Pointer line (S5).
> - C3. ES-n texts are copied verbatim from the design. An Engine passage that points into another
>   Skill links that Skill's `SKILL.md` only (S6). No Engine text names an unavailable feature by an
>   identifier the guard matches (§C13 plain-words rule).
> - C4. Front-matter `name` does not change. A reworded `description` gets no marker and gets a
>   `description` entry in the change file.
> - C5. The sub-task adds the empty file `tools/repo-check/converted/<folder>` and writes
>   `tools/repo-check/supabase-view-changes/<folder>.json` (entries `release: "unreleased"`; `[]`
>   if there is none). It edits no other folder, `README.md`, `CHANGELOG.md` or `skill-map.json`.
> - FD (folder done). With `converted/<folder>` present, `node --test "tools/repo-check/test/*.test.mjs"`
>   and `node tools/repo-check/check.mjs` exit 0 on the pull request head. The pull request
>   description records reader, date and commit of the read-through of `<out>/engine/<folder>`,
>   `<out>/supabase/<folder>` and that folder's hunks of `<out>/supabase-vs-baseline.diff`, made with
>   `node tools/repo-check/check.mjs --render <out>` (Testing Strategy steps 2 and 3).
>
> The 20 UC folders (rows 45-64) get no task. R7 holds them byte-identical to `v1.0.0` from the
> first pull request (2.6, 3.3, 9.1).

## Tasks

- [x] 1. Cut the baseline tag `v1.0.0` on `origin/main` before any change of this feature merges
  - Done 16 October 2026 by the maintainer's instruction: annotated tag `v1.0.0` (object `f76d8be`)
    on `7ed910f`, listed by `git ls-remote --tags origin`; its message words the baseline
    differently from S9's, and the tag is not moved.
  - Maintainer task. Nothing else for this feature merges to `main` before this tag exists.
  - Create an annotated tag on `origin/main` as it stands then (`7ed910f` if nothing else merged),
    message `Baseline_Revision: the last revision of main before backend-aware-skills` (S9). Push it.
    The tag is never moved.
  - Done when: `git fetch --tags origin && git cat-file -t v1.0.0` prints `tag`,
    `git rev-parse 'v1.0.0^{commit}'` equals the `origin/main` commit at tagging, and
    `git ls-remote --tags origin v1.0.0` lists it.
  - _Requirements: 6.1_

- [ ] 2. Build the Repository_Check in `tools/repo-check/` (design Group 1, with task 3)
- [x] 2.1 Write the shared contract data and its pinning test
  - Add `tools/repo-check/contract/backend-contract.json` exactly as printed in S8: marker regex,
    token, kinds, `onlyDirs`, `steeringToken`, the nine issue codes, the 13 guard patterns
    (alternation unescaped), path rule, fenced-block rule, `fencedLinksAreLinks: false`, and the
    seven recorded link breaks.
  - Add `contract/cases.json` with marker, guard and link cases in the shape of Data Models.
  - Add `test/contract.test.mjs`. It holds a second, literal copy of the §C13 regex and the §C20
    table and fails on any difference (R12). Running `cases.json` through the libraries is added to
    this test in 2.9, once they exist.
  - Done when: `node --test tools/repo-check/test/contract.test.mjs` passes, and fails after one
    character of any regex in the JSON is changed.
  - _Requirements: 7.1, 7.8_
- [x] 2.2 Implement passages and views (`lib/passages.mjs`, R2)
  - Implement `validateMarkers`, `validateMarkerPlacement`, `fileBackend` and
    `stripBackendPassages` from S8's data, and `authoringIssues`, which reports `straddles-fence`,
    `marker-in-table` and `gap-between-passages` (S6).
  - Add `test/passages.test.mjs` with every case the Testing Strategy lists for it. This includes
    each comment opener, each `MarkerIssue` code, a kiro-style copy that keeps its file marker,
    `*-only` folders, CRLF kept, and a file with no marker unchanged in both views.
  - Done when: `node --test tools/repo-check/test/passages.test.mjs` passes and every `markerCases`
    entry of `cases.json` gives its expected issues.
  - _Requirements: 1.8, 1.9, 7.8_
- [x] 2.3 (P) Implement the guard (`lib/guard.mjs`, R1)
  - `scanView(path, text)` applies the 13 §C20 patterns per line, the path rule, the fenced-block
    rule, and this repository's `x-pp29-tool` patterns (never written to the contract file).
  - Add `test/guard.test.mjs`: a positive and a negative for each pattern. The negatives include
    same-origin `credentials: 'include'`, a `"module_access_keys": [...]` field, plain-words prose,
    and the S3 Gate, S7-A, S7-B and every ES-1 to ES-16 text, held in the test as the design prints
    them (`gate.md` does not exist until 2.5, which scans it itself).
  - Done when: `node --test tools/repo-check/test/guard.test.mjs` passes, and every `guardCases`
    entry gives its expected ids.
  - _Requirements: 3.1, 3.2, 7.1_
  - _Boundary: tools/repo-check/lib/guard.mjs, test/guard.test.mjs_
- [x] 2.4 Implement link extraction and resolution (`lib/links.mjs`, R6a, R6b)
  - `extractLinks` skips CommonMark fences. `resolves` works per view. `isRecordedBreak` matches by
    file and target.
  - Add `test/links.test.mjs`: inline and reference-style links, anchors, the nested four-backtick
    fences of `generate-docs` (lines 245, 286, 287, 413 are not links), a link in one view only, a
    target removed in one view, each of the seven recorded breaks, and a recorded break whose link
    is gone.
  - Done when: `node --test tools/repo-check/test/links.test.mjs` passes, and every `linkCases`
    entry gives its expected links.
  - _Requirements: 2.3, 3.15, 7.5_
- [x] 2.5 Write the canonical Gate and its rule (`gate.md`, `lib/gate.mjs`, R3)
  - Add `tools/repo-check/gate.md` with the S3 block byte for byte: the sentinels, steps 1 to 4,
    the no-secrets paragraph, the definition of a part, and the stop sentence.
  - `gateIssues` reports: Gate absent, misplaced by S4, or not byte-identical (line endings
    normalised); a Skill with a passage whose `SKILL.md` lacks the Gate; a missing Pointer (S5); a
    link from another Skill into `assets/`; a link to a comment-less `*-only` file from another
    Skill or from text of the other kind.
  - Add `test/gate.test.mjs` with the Testing Strategy cases, including "an unconverted folder fails
    nothing".
  - Done when: `node --test tools/repo-check/test/gate.test.mjs` passes, and `scanView` over
    `gate.md` returns no finding and the file holds no `buildpad-backend` token.
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.10, 1.11, 1.12, 4.8, 7.2_
- [x] 2.6 Implement the checked set and baseline parity (`lib/checked-set.mjs`, `lib/baseline.mjs`, R5, R7)
  - `checkedSet` uses `git ls-files` in a work tree. Otherwise it uses `git ls-tree -r --name-only <ref>`,
    or else a directory walk that skips `.git/`. The set is every folder with `SKILL.md`, plus
    `agents/` and `references/`. It excludes root files, `.github/`, `.kiro/` and `tools/`.
  - `showAtRef` reads the baseline. `supabaseViewParity` removes the Gate block plus one blank line,
    the Pointer line and the `description` value. R7 is strict for UC rows always, and applies to
    other rows only when `converted/<folder>` exists. R5 compares `name` with the baseline.
  - Add `test/baseline.test.mjs` in a temporary git repository tagged `v1.0.0`, with every R5, R7
    and `git archive` case of the Testing Strategy.
  - Done when: `node --test tools/repo-check/test/baseline.test.mjs` passes, including a UC folder
    with one changed byte (fails) and a moved-not-rewritten passage (passes).
  - _Requirements: 2.1, 2.2, 2.4, 2.5_
- [x] 2.7 Add the machine Skill_Map and the map, template and README rules (`skill-map.json`, `lib/map.mjs`)
  - `skill-map.json`: 64 rows, one per folder of the requirements' Skill map, with `dependence`,
    `treatment`, `size` as written there and `plan` from the marking plan (BP 21, EF 3, US 2, NY 2,
    RW 14, RW+G 2, UC 20).
  - `mapIssues` covers R4: a folder without a row, a row without a folder, and a marker in a
    `wording only` folder. `templateIssues` covers R8: `/supabase/i` or a §C20 match in
    `*/settings-templates/**` or in the `rules/**` of the spec and steering Skills. It also covers
    R9, a subfolder under `references/`. `readmeIssues` covers R11: catalogue coverage and the
    `#v1.0.0` command.
  - Add `test/map.test.mjs`, `test/templates.test.mjs` and `test/readme.test.mjs`.
  - Done when: these three tests pass, and a script comparing `skill-map.json` with the
    requirements' Skill map table finds 64 equal rows and the plan counts above.
  - _Requirements: 5.1, 5.2, 5.6, 5.8, 6.4, 6.7, 7.3_
- [x] 2.8 Implement the release rules (`lib/release.mjs`, R10, R13)
  - R10 runs on every run: a change-file entry whose `release` is a tag but whose path is missing
    from that tag's `CHANGELOG.md` section fails. A missing `CHANGELOG.md` counts as having no
    sections (the file is created in 3.2, after this rule). With `--tag`, it also fails when the tag has no
    section or any entry is still `unreleased`.
  - R13 runs only with `--tag`: any non-UC row that has no `converted/<folder>` fails.
  - Tests go in `test/map.test.mjs` (R13) and `test/baseline.test.mjs` (R10), with the cases the
    Testing Strategy lists.
  - Done when: these tests pass, including "an `unreleased` entry between releases passes",
    "the same entry on a tag push fails" and "R13 fails with one non-UC row unconverted".
  - _Requirements: 2.4, 6.2, 7.1, 7.2_
- [x] 2.9 Implement the CLI (`check.mjs`) and the front-matter and coverage tests
  - `main(argv)` takes the options of Interface: `--root`, `--baseline-ref`, `--skill-map`, `--tag`,
    `--only`, `--render`. Exit codes are 0, 1 and 2. A finding line is
    `<rule> <path>:<line> <code> <message>`, plus `::error file=,line=::` under GitHub Actions. Every
    finding is reported, with no stop at the first (Error Handling). It runs R1 to R13 from the
    modules of 2.1 to 2.8, R12 included (the contract file against its literal copy, and every
    `cases.json` case). The CLI applies the converted-folder switch: R1, R3, R6b and non-UC R7 run
    only on folders that have `converted/<folder>`.
  - Extend `test/contract.test.mjs` so that every `cases.json` case runs through `lib/passages.mjs`,
    `lib/guard.mjs` and `lib/links.mjs` with its expected result (Testing Strategy).
  - `--render` writes `engine/**`, `supabase/**` and `supabase-vs-baseline.diff`.
  - Add `test/frontmatter.test.mjs` (R5: `name` and `description` in the raw file and both views,
    for `SKILL.md` and `agents/*.md`). Add one fixture test that applies R1, R2 and R3 to a persona,
    a top-level reference and a `settings-templates` file.
  - Done when: `node --test "tools/repo-check/test/*.test.mjs"` passes, `contract.test.mjs` included
    with the cases. `check.mjs --only R99` exits 2. A missing baseline tag exits 2 with the Error
    Handling message. `check.mjs --only R12` exits 0, and exits 1 after one character of a case's
    expected result is changed.
  - _Requirements: 7.4, 7.9_
  - Note 16 October 2026: between 2.9 and 3.1, `check.mjs` on the tree reports only R11's two
    findings (the README lacks the `#v1.0.0` command and `add-microfrontend-zones`); every other
    rule exits 0 there. 3.1 clears them.
- [ ] 2.10 Add the CI workflow `.github/workflows/repo-check.yml`
  - Triggers: `pull_request` to `main`, `push` to `main`, and `push` of tags `v*`. Uses
    `permissions: contents: read` and no secret, and does not use `pull_request_target`.
  - Job `check`: `actions/checkout@v4` with `fetch-depth: 0`, then `actions/setup-node@v4` with
    Node 22, then the tests, then `check.mjs`. On a tag push, `check.mjs` gets
    `--tag "$GITHUB_REF_NAME"`.
  - Job `baseline`: `git archive v1.0.0` into `$RUNNER_TEMP/baseline`, then
    `check.mjs --root $RUNNER_TEMP/baseline --baseline-ref v1.0.0 --only R4,R5,R6a --skill-map tools/repo-check/skill-map.json`.
  - Done when: on the pull request of tasks 2 and 3, both jobs run and end green.
  - _Requirements: 7.7_
  - Note 16 October 2026: the workflow and `test/workflow.test.mjs` are committed on
    `feat/backend-aware-skills-repo-check`; both jobs' commands pass locally on Node 24 (the
    `baseline` command exits 0). Left unticked: the Done-when needs the pull request's CI run on
    Node 22, which no one has opened yet.

- [ ] 3. Write the README, CONTRIBUTING and the first CHANGELOG, and land the check green on the unconverted tree (same pull request as task 2)
- [x] 3.1 Rewrite `README.md` for the two kinds of project
  - Add the sections from Distribution and README: **Two kinds of project** (6.6), and **Install**
    with `#v2.0.0`, `--all`, `#v2.0.0@create-project` and the tree URL, with no hard-coded `main`
    (6.3). Add **Stay on the skills as they were before Engine support**, with
    `npx skills add buildpad-ai/skills#v1.0.0` and `--all` (6.4). Rewrite **Update** for a Kit-made
    project (6.5). Add links to `CHANGELOG.md` and the GitHub Releases (6.2).
  - Catalogue: all 62 Skills, each with a description true for both kinds or naming its kind (6.7).
    Rows 1, 2, 3, 9, 10, 13, 16, 19, 22 and 24 carry the reworded description that their folder
    sub-task copies into front matter. This task fixes that wording.
  - Done when: `node tools/repo-check/check.mjs --only R11` exits 0, and the catalogue lists each of
    the 62 Skill folders once.
  - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
- [x] 3.2 Write `CONTRIBUTING.md` and start `CHANGELOG.md`
  - Create `CHANGELOG.md` at the root (design Group 1) with one section, `v1.0.0`, naming it the
    Baseline_Revision (`7ed910f`), so the README's link from 3.1 resolves. No folder task edits it;
    9.2 and 10.8 add the later sections.
  - `CONTRIBUTING.md` documents the §C13 marker forms (S6), the authoring rules, the Gate and its
    placement (S4), the Pointer (S5), the ES-1 to ES-16 set, change files and `converted/` files, and
    the rule that Engine text names Platform fields otherwise (`authUrl`, `publicKey`; Issue 2).
  - It also documents how to add a Skill: a row in `skill-map.json` and the requirements' Skill map,
    and Requirements 1 to 4 met. It sits outside the checked set, so it may write the marker token.
  - Done when: both files exist at the root, `CONTRIBUTING.md` holds every topic above,
    `CHANGELOG.md` holds the `v1.0.0` section and no other, and `check.mjs` still exits 0 (R10 finds
    no released entry).
  - _Requirements: 5.8, 6.2_
- [ ] 3.3 Prove the check green on the baseline text and merge tasks 2 and 3 as one pull request
  - Run on the branch, with no `converted/` file present: `node --test "tools/repo-check/test/*.test.mjs"`,
    then `node tools/repo-check/check.mjs`, then the `baseline` job command.
  - Done when: all three exit 0 locally and in CI. `git diff --stat v1.0.0 HEAD` lists only
    `tools/`, `.github/`, `README.md`, `CONTRIBUTING.md` and `CHANGELOG.md` (and `.kiro/` if the spec
    itself is committed). The pull request is merged.
  - _Requirements: 2.2, 7.7_
  - Note 16 October 2026: run locally on Node 24 at the head of
    `feat/backend-aware-skills-repo-check`, with no `converted/` file: the tests (215) pass,
    `check.mjs` exits 0 with no finding, and the `baseline` job command exits 0.
    `git diff --stat v1.0.0 HEAD` lists only `tools/`, `.github/`, `README.md`, `CONTRIBUTING.md`,
    `CHANGELOG.md` and `.kiro/`. Left unticked: CI on the pull request and the merge are still to
    come.
- [ ] 3.4 Make `check` and `baseline` required status checks on `main` (maintainer, repository setting)
  - Done when: the branch-protection settings for `main` list both checks as required. The design's
    "T-0.3" is this task.
  - _Requirements: 7.1_
  - Note 16 October 2026: not done here (a repository setting for the maintainer). The checks to
    require are the two jobs of `.github/workflows/repo-check.yml`, named `check` and `baseline`
    (shown in GitHub as `repo-check / check` and `repo-check / baseline`). They can be chosen
    once they have run on the pull request of tasks 2 and 3.

- [ ] 4. Convert the data and access Skills (design Group 3; after task 3; before tasks 7 and 8; parallel with tasks 5 and 6)
- [ ] 4.1 (P) Convert `add-i18n` (row 7, BP)
  - `SKILL.md` 39-42, 57, 69-70, 119, 125-131. `references/content-translations.instructions.md`
    11-13, 21-142 (SQL mirror 121-142 sup), 150-310 (SQL mirror 288-310 sup), 316-334, 397-468.
    `references/locale-routing.instructions.md` 9, 93-160. The Gate goes in all three files.
  - Engine content: ES-8 (`POST /api/collections` with inline fields, or `POST /api/schema/apply`
    for a multi-column unique) and ES-9. There is no SQL mirror. Language is set through
    `PATCH /api/users/me`.
  - Done when: FD holds for `add-i18n`.
  - _Requirements: 1.2, 1.9, 2.1, 3.6, 3.9, 3.15_
  - _Boundary: add-i18n/, converted/add-i18n, supabase-view-changes/add-i18n.json_
- [ ] 4.2 (P) Convert `create-collection` (row 16, BP)
  - `SKILL.md` line 3: reword the description to "with its schema", with no marker (C4). Then lines
    15 (sup), 55-57, 75-84, 88-120, 217-227, 251-275 and 287-291. Move the link at 288 into sup; its
    eng counterpart links `create-api-route/SKILL.md`. In `references/standard-fields.instructions.md`:
    13-16, 22-147, 175-198 (SQL sup) and 206-295.
  - Engine content: ES-8 (the schema block through REST; `date_created` needs a default) and ES-9.
    The user relation targets `daas_users`. The scope field uses
    `meta.options.related_collection: daas_scope_items`. Delete answers 204.
  - Done when: FD holds for `create-collection`, and `git grep -n api-routes.instructions create-collection/`
    shows the link only inside a `supabase` passage.
  - _Requirements: 1.2, 1.9, 2.1, 2.4, 3.6, 3.9, 3.15_
  - _Boundary: create-collection/, converted/create-collection, supabase-view-changes/create-collection.json_
- [ ] 4.3 (P) Convert `create-rbac` (row 20, BP)
  - `SKILL.md` 22-26, 41-70, 112-152, 162-249 and 262-271. Line 288 is a recorded break and stays
    unchanged. `references/rbac-setup.instructions.md` 43, 90-95, 113-115, 132, 169-205, 243-271 and
    341-373, with ES-6 beside `enforce_tfa` at line 94. `references/permissions-filtering.instructions.md`
    112-190, 249-267 and 415-520.
  - Engine content: ES-8 and ES-16. Role-scope patterns start with the tenant segment. Uses the
    `scope` tool's `assign_user_role` with `assignment`, and `POST /api/users/:id/roles`.
    `$CURRENT_ROLES`/`$CURRENT_POLICIES` and relation paths are refused. Presets and validation are
    not applied (EP-28). One rule per policy, collection and action. Module keys go through `items`
    on `daas_module_access_keys`.
  - Done when: FD holds for `create-rbac`.
  - _Requirements: 1.2, 1.9, 2.1, 3.6, 4.6, 3.15_
  - _Boundary: create-rbac/, converted/create-rbac, supabase-view-changes/create-rbac.json_
- [ ] 4.4 (P) Convert `create-workflow` (row 23, BP)
  - `SKILL.md` 21-35, 97-171 (SQL migration 158-171 sup), 195 and 208-298.
    `references/workflow-schema.instructions.md` 473-590, 709-757, 903-1085 and 1118-1123. Move the
    link at 1130 into sup; its eng counterpart links `hooks-extensions/SKILL.md`.
    `references/workflow-versioning.instructions.md` 28-91, 214-297 and 780.
  - Engine content: ES-8. Definitions go through `POST`/`PATCH /api/workflows`, assignments through
    `/api/workflow-assignments`. The `fields` tool reads `data.field`. A field-list restriction
    replaces the hook of 272-287.
  - Done when: FD holds for `create-workflow`, and the 1130 link lies inside a `supabase` passage.
  - _Requirements: 1.2, 1.9, 2.1, 3.6, 3.15_
  - _Boundary: create-workflow/, converted/create-workflow, supabase-view-changes/create-workflow.json_
- [ ] 4.5 (P) Convert `grant-module-access` (row 26, BP)
  - `SKILL.md` 26-63 (the `module_access_keys` tool, sup), 71, 126-154 (the remote procedure, sup),
    158-177 and 221. `references/module-access.instructions.md` 44-93, 134-149, 168-209 (extra
    column, sup), 213-384 (custom policies, sup) and 438-458.
  - Engine content: keys are registered with the `items` tool on `daas_module_access_keys`. The
    seeded keys are `system:logs`, `workflow:approve` and `workflow:reject`. The server check
    follows ES-16. An administrator passes every gate. Custom policy columns are not available on an
    Engine project.
  - Done when: FD holds for `grant-module-access`. R1 reports nothing at former hits
    `SKILL.md:34,51,139` and `module-access.instructions.md:68,137`.
  - _Requirements: 1.2, 1.9, 2.1, 3.1, 4.7, 3.15_
  - _Boundary: grant-module-access/, converted/grant-module-access, supabase-view-changes/grant-module-access.json_
- [ ] 4.6 (P) Convert `manage-scope` into a separate Engine file set (row 28, EF)
  - `SKILL.md`: the Gate after the H1. The sup passage is body 9-760 verbatim. The eng passage is a
    new body linking the two new Engine files and the shared `scope-client`.
  - `references/scope-management.instructions.md` and `references/scope-permissions.instructions.md`
    become file:sup. New `references/engine-scope-management.instructions.md` and
    `references/engine-scope-permissions.instructions.md` get the `engine` file marker and the Gate.
    `references/scope-client.instructions.md` stays shared, with in-file passages at 11-22, 108-157
    and 247-287.
  - The Engine text covers the lines that differ at `7ed910f` (row 28): `SKILL.md` 9-54, 60-184,
    186-399, 403-431, 517-616 and 709-754; `scope-management` 13-62, 100-131, 155-302 and 335-344;
    `scope-permissions` 44-215. Content: ES-9 (customers are
    second-level nodes; `uri_path` is composed by the server; delete does not cascade) and ES-4.
    `assign_user_role` takes its arguments under `assignment`. REST role assignment uses
    `resource_uri`. `missing_uri_mode` is `strict`/`reject`, `inheritance_mode` is `exact`/`down`,
    and the error is `MISSING_SCOPE`. The MCP `items` tool takes no scope argument.
  - Done when: FD holds for `manage-scope`. `--render` shows the Engine view holding `SKILL.md`, both
    Engine files and `scope-client` with every link resolving, and the Supabase view equal to the
    baseline apart from the Gate.
  - _Requirements: 1.2, 1.3, 1.9, 2.1, 3.8, 3.9, 5.3, 3.15_
  - _Boundary: manage-scope/, converted/manage-scope, supabase-view-changes/manage-scope.json_
- [ ] 4.7 (P) Convert `relational-permissions` (row 30, BP)
  - `SKILL.md` 49-60, 76-91 and 142-198. Remove the dead link at 242; record it as a `removed-link`
    entry with its reason (Issue 3).
  - Engine content: enforcement is unconditional (no warn mode). The `relations` tool reads and the
    `permissions` tool creates. `$CURRENT_POLICIES` is refused. Relations go three deep. Presets and
    validation are not applied (EP-28).
  - Done when: FD holds for `relational-permissions`, and the change file holds the `removed-link`
    entry.
  - _Requirements: 1.2, 1.9, 2.1, 2.4, 3.6, 3.15_
  - _Boundary: relational-permissions/, converted/relational-permissions, supabase-view-changes/relational-permissions.json_

- [ ] 5. Convert the apps and platform Skills (design Group 5; after task 3; before task 8; parallel with tasks 4 and 6)
- [x] 5.1 (P) Convert `add-buildpad` (row 4, BP)
  - `SKILL.md` 29-38, 45, 85 and 113. `references/buildpad.instructions.md` 89-109, 138, 157-166,
    399-416, 534-635, 665-710, 923-964, 1044-1069 and 1169-1199.
  - Engine content: ES-1, ES-2 (DaaSProvider and Storybook take a session token), ES-11 (asset path)
    and ES-16. Deletes answer 204 with no body. `limit=-1` is refused.
  - Done when: FD holds for `add-buildpad`.
  - _Requirements: 1.2, 1.9, 2.1, 3.1, 3.3, 3.11, 3.15_
  - _Boundary: add-buildpad/, converted/add-buildpad, supabase-view-changes/add-buildpad.json_
  - Note 16 October 2026: read through the Engine and Supabase views of `SKILL.md` and
    `references/buildpad.instructions.md` from `check.mjs --render`; the Supabase view is `v1.0.0`
    but for the Gate, and the change file is `[]`. Ranges were widened to their whole fences and
    tables, and 89-109 and 923-964 were split at the `##` headings inside them (S6). The Engine
    serves `limit=-1` as its cap of 1000 rather than refusing it, so the Engine text says that; only
    a single-item delete answers 204 with no body.
- [x] 5.2 (P) Convert `add-files` (row 6, BP)
  - `SKILL.md` 26-28, 47, 53-67 and 136-166.
  - Engine content: ES-1, ES-11 and ES-15. The upload limit is `APP_MAX_UPLOAD_BYTES` (100 MiB),
    with no MIME allow list. Delete answers 204. The generated assets proxy targets a path the Engine
    does not serve (Issue 6), and the text states this.
  - Done when: FD holds for `add-files`.
  - _Requirements: 1.2, 1.9, 2.1, 3.3, 3.11, 3.15_
  - _Boundary: add-files/, converted/add-files, supabase-view-changes/add-files.json_
  - Note 16 October 2026: read through the Engine and Supabase views of `SKILL.md` from
    `check.mjs --render`; the Supabase view is `v1.0.0` but for the Gate, and the change file is
    `[]`. The Engine text keeps the module's hooks and steps, states that the generated assets proxy
    forwards to a path the Engine does not serve (so `getAssetUrl` previews do not load), and shows a
    file in a browser through `GET /api/files/signed-url`.
- [x] 5.3 (P) Convert `add-microapp` (row 8, BP)
  - `SKILL.md` 13-26, 72-86 (Step 0), 138-149, 151-213, 350-394, 585-596 and 626. Move the links at
    26 and 170 into sup. In references: `context-discovery` 32-48, 120-130 and 153-158;
    `app-urls-config` 8-16, 115 (link, sup) and 118-140; `deployment-topology` 5-63, 140-156, 203
    and 246; `cross-service-communication` 7, 40, 73-92 and 123-146; `service-boundaries` 82 and 171.
  - Engine content: Step 0 reads `projectBackend`, `engineUrl`, `daasUrl`, `projectTenantId`,
    `tenantVariable` and `publicAnonKey`, and never stops on an absent Supabase value. Also ES-1,
    ES-3 (in the main app and every microapp), ES-15, ES-10 (event hook body) and ES-8.
  - Done when: FD holds for `add-microapp`. The three `auth-bridge` links lie inside `supabase`
    passages, and their eng counterparts link `add-microfrontend/SKILL.md`.
  - _Requirements: 1.2, 1.9, 2.1, 3.1, 3.3, 3.4, 3.15_
  - _Boundary: add-microapp/, converted/add-microapp, supabase-view-changes/add-microapp.json_
  - Note 16 October 2026: read through the Engine and Supabase views of `SKILL.md` and the five
    references from `check.mjs --render`; the Supabase view is `v1.0.0` but for the Gate, and the
    change file is `[]`. The three `auth-bridge` links lie inside `supabase` passages and their
    Engine counterparts link `add-microfrontend/SKILL.md`. Because composition is not yet available
    on an Engine project (rows 9 and 10), passages were added beyond the listed ranges where the
    baseline gave iframe, bridge or Supabase steps: `SKILL.md` 9, 30-66, 131-136, 231-289, 421-453,
    457-526, 530-540, 562-583; `context-discovery` 66-69, 164-171; `app-urls-config` 45-50,
    68-91, 95-112; `deployment-topology` 67-77, 133-136, 181-188. In the Engine view each app
    runs on its own address, the Main App only links to the micro-apps, and framing is stated as not
    yet available. Adjacent ranges were joined (gap rule) and ranges widened to whole fences, tables
    and lists. The `Engine runtime` table sits beside the event-hook body it governs.
- [x] 5.4 Convert `add-microfrontend` (row 9, NY)
  - `SKILL.md`: the Gate, then the eng passage "Sharing one session between a host and its frames is
    not available on an Engine project yet. Tell the developer so and stop.". The sup passage is the
    rest of the body. Its description is reworded to name the kind (C4).
  - Every `references/*.md` (5 files) becomes file:sup. Every `assets/**/*.ts(x)` (14 files) gets
    `// buildpad-backend-file: supabase` on line 1, then the Pointer.
  - Done when: FD holds for `add-microfrontend`. The Engine view holds only `SKILL.md`, made of the
    Gate and the stop text.
  - Not (P): it file-marks `auth-bridge.instructions.md`, which 5.3 links.
  - _Requirements: 1.2, 1.6, 1.9, 2.1, 3.5, 4.7, 4.8, 3.15, 2.4_
  - _Depends: 5.3_
  - Note 16 October 2026: read through the views from `check.mjs --render`: the Engine view of
    `add-microfrontend` is `SKILL.md` alone, the Gate and the stop text; the Supabase view is
    `v1.0.0` but for the Gates, the Pointer lines and the description, whose rewording ("Supabase
    projects only for now: not yet available on an Engine project") is the change file's one entry.
    The five references are file:sup, and the 14 assets carry the file marker and the Pointer.
- [x] 5.5 (P) Convert `add-microfrontend-zones` (row 10, NY)
  - `SKILL.md`: the Gate, the NY stop text as in 5.4, and the sup passage for the rest. Its
    description is reworded (C4). `references/pinned-edits.instructions.md` becomes file:sup. Each
    `assets/**/*.ts(x)` (9 files) gets the file marker and the Pointer. `assets/shared/zones.json`
    stays unchanged.
  - Done when: FD holds for `add-microfrontend-zones`. R1 reports nothing at the `platform-supabase`
    lines 126, 138, 344, 345, 349 and 504.
  - _Requirements: 1.2, 1.6, 1.9, 2.1, 4.7, 3.15, 2.4_
  - _Boundary: add-microfrontend-zones/, converted/add-microfrontend-zones, supabase-view-changes/add-microfrontend-zones.json_
  - Note 16 October 2026: read through the views from `check.mjs --render`: the Engine view of
    `add-microfrontend-zones` is `SKILL.md` (the Gate and the stop text of 5.4, word for word) and
    the unchanged `assets/shared/zones.json`; the Supabase view is `v1.0.0` but for the Gates, the
    Pointer lines and the description, whose rewording is the change file's one entry. The
    `platform-supabase` lines 126, 138, 344, 345, 349 and 504 lie inside the `supabase` passage,
    so R1 reports nothing.
- [x] 5.6 (P) Convert `create-project` (row 19, BP)
  - `SKILL.md` line 3 (description, C4), then 15-19, 46-73, 88-143, 165-192 (the MCP cross-origin
    step, sup) and 256-268. `references/environment.instructions.md` 19-106, with the service-role
    block 51-61 as sup. `references/project-creation.instructions.md` 59-67, 95 and 110.
  - Engine content: ES-1, ES-3, ES-4, ES-5 (no callback deliverable), ES-15 and ES-16. A local Engine
    runs on `:8080`. Troubleshooting covers: the Engine answers, the account has a role in the
    tenant, and `TOKEN_INVALID` means sign in again.
  - Done when: FD holds for `create-project`.
  - _Requirements: 1.2, 1.9, 2.1, 3.3, 3.4, 3.5, 3.8, 3.16, 3.15, 2.4_
  - _Boundary: create-project/, converted/create-project, supabase-view-changes/create-project.json_
  - Note 16 October 2026: read through the Engine and Supabase views of `SKILL.md`,
    `environment` and `project-creation` from `check.mjs --render`; the Supabase view is `v1.0.0`
    but for the Gates and the reworded description (the change file's one entry). Ranges were
    widened to whole fences, `SKILL.md` 46-73 and 256-268 were split around lines that hold for
    both backends, and the service-role block 51-61 is `supabase` text with ES-3's "add none" as
    its Engine counterpart. `project-creation` has no front matter, so its Gate stands before line 1.
- [ ] 5.7 (P) Convert `create-tests` (row 22, BP)
  - `SKILL.md` line 3 (description, C4), then 24-80, 110, 176-178, 227-266, 359-392, 428 and
    453-456. `references/playwright-testing.instructions.md` 59-75, 178-306, 355-374, 485-528,
    907-958, 1351-1367, 1453-1729, 2006-2064 and 2124-2127.
  - Engine content: ES-7, ES-12 and ES-4 (a direct sign-in sends `X-Tenant-Id`). The administrator
    password comes from a pipeline secret. `isAdmin` sits beside `data`. On `/api/items`, create
    answers 200 and delete 204. The account-creation and rate budgets are stated.
  - Done when: FD holds for `create-tests`.
  - _Requirements: 1.2, 1.9, 2.1, 3.7, 3.8, 3.12, 3.17, 3.15, 2.4_
  - _Boundary: create-tests/, converted/create-tests, supabase-view-changes/create-tests.json_
- [ ] 5.8 (P) Convert `daas-platform` (row 24, BP, kept in-file per Issue 9)
  - `SKILL.md` line 3 (description, C4), then 9-35, 51-85, 87-153, 164, 176-192 (including 189) and
    207-292. `references/daas-api.instructions.md` 11-97, 101-292, 339-362, 472-565 and 573 (link,
    sup). `references/daas-mcp-tools.instructions.md` 101-169, 305, 636, 685, 1156-1481 (tools the
    Engine lacks, sup; links 1158 and 1271 sup), 1548-1561 (tools the Engine lacks, sup), 1589-1710
    and 1718 (link, sup). `references/builtin-features.instructions.md`
    25, 63, 71-165 and 210-265. `references/nextjs.instructions.md` 13-17 and 46-47.
  - Engine content (5.5): the architecture, ES-1 to ES-6, ES-8 to ES-11, ES-15, and the Engine MCP
    tools served. `deep`, `meta` and `version` are ignored, and `limit` is capped at 1000. Error codes
    are `UNAUTHENTICATED`, `TOKEN_INVALID` and `TOKEN_EXPIRED`.
  - Done when: FD holds for `daas-platform`, and the links 573, 1158, 1271 and 1718 lie inside
    `supabase` passages, with eng counterparts linking `hooks-extensions/SKILL.md` or
    `create-cron/SKILL.md`.
  - _Requirements: 1.2, 1.9, 2.1, 3.1, 3.3, 3.5, 3.8, 3.10, 3.11, 4.6, 5.5, 3.15, 2.4_
  - _Boundary: daas-platform/, converted/daas-platform, supabase-view-changes/daas-platform.json_
- [ ] 5.9 (P) Convert `debugging-and-error-recovery` (row 25, BP)
  - `SKILL.md` 57-60, 87-88 (the MCP cross-origin fix, sup) and 112-117.
  - Engine content: Engine causes (`TOKEN_INVALID`, `FORBIDDEN_SCOPE`, `MISSING_SCOPE`, sign-in
    naming a foreign tenant, `ReferenceError` from `fetch`/`process`/`require`, and the Supabase
    service refused), logs at `/api/logs`, and ES-15.
  - Done when: FD holds for `debugging-and-error-recovery`.
  - _Requirements: 1.2, 1.9, 2.1, 3.1, 3.15_
  - _Boundary: debugging-and-error-recovery/, converted/debugging-and-error-recovery, supabase-view-changes/debugging-and-error-recovery.json_
- [ ] 5.10 (P) Convert `security-and-hardening` (row 31, BP)
  - `SKILL.md` 26, 29-36, 56-90, 119-132 and 161. The service-role lines are sup.
  - Engine content: ES-2, ES-3, ES-5 and ES-15. The Engine refuses caller-supplied SQL.
  - Done when: FD holds for `security-and-hardening`.
  - _Requirements: 1.2, 1.9, 2.1, 3.2, 3.4, 3.5, 3.15_
  - _Boundary: security-and-hardening/, converted/security-and-hardening, supabase-view-changes/security-and-hardening.json_
- [ ] 5.11 (P) Convert `worker-messaging` (row 44, BP with an Engine passage only)
  - `SKILL.md`: the Gate after the H1, and a new eng section "Reaching the data service from a
    worker" after Step 3b (line 136) holding ES-14n verbatim. There is no sup text. The Supabase view
    is the baseline apart from the Gate.
  - Done when: FD holds for `worker-messaging`. `--render` shows the Supabase view byte-equal to
    `v1.0.0` once the Gate is removed, and the change file is `[]`.
  - _Requirements: 1.2, 1.6, 1.9, 2.1, 3.2, 4.7, 5.7, 5.9, 3.15_
  - _Boundary: worker-messaging/, converted/worker-messaging, supabase-view-changes/worker-messaging.json_

- [ ] 6. Convert the Shared_Guidance and reword the wording-only Skills (design Group 6; after task 3; parallel with tasks 4 and 5)
- [ ] 6.1 (P) Mark the agent personas (row 13, BP)
  - `security-auditor.md` 3 (description, C4), 39-43 and 48. `code-reviewer.md` 51.
    `test-engineer.md` 64-65. Each file gets the Gate after its front matter. `name` stays unchanged.
  - The Supabase checks go in sup: service-role key server-side, RLS, SQL functions, OAuth. The eng
    checks: no service-role key may appear; the long-lived secrets are the MCP token and the worker
    token; any-origin-without-credentials CORS is the provisioned state; isolation is roles,
    policies, permissions and scope; review code elevated with `{ elevated: true }`; ES-5's
    unavailable list counts as findings; ES-7 applies to test users.
  - Done when: FD holds for `agents`.
  - _Requirements: 1.2, 1.9, 3.13, 5.10, 7.9, 2.4_
  - _Boundary: agents/, converted/agents, supabase-view-changes/agents.json_
- [ ] 6.2 (P) Mark the top-level reference checklists (row 29, BP)
  - `security-checklist.md` 11-18, 51-64 and 123-127: the Gate at the top, the service-role and RLS
    lines in sup, and the 3.13 replacements in eng. `module-access-checklist.md` 8-16: the Gate, and
    sup/eng for the server check (ES-16). The other three files stay unchanged. No subfolder is
    added (R9).
  - Done when: FD holds for `references`, and R1 reports nothing at former hit
    `security-checklist.md:125`.
  - _Requirements: 1.2, 1.9, 3.13, 5.10, 7.9_
  - _Boundary: references/, converted/references, supabase-view-changes/references.json_
- [ ] 6.3 (P) Reword `add-users` (row 11, RW)
  - `SKILL.md` 9-18, 30-32, 44, 125, 135-143 and 159 become qualified sentences: ES-7 (a role in the
    tenant on create); on an Engine project a static token is an MCP credential; "scope", not
    "tenant". There is no marker and no Gate.
  - Done when: FD holds for `add-users`, and its change file has one `text` entry with a reason.
  - _Requirements: 3.7, 3.17, 5.2, 2.4_
  - _Boundary: add-users/, converted/add-users, supabase-view-changes/add-users.json_
- [ ] 6.4 (P) Reword `authentication-proxy` (row 14, RW)
  - `SKILL.md` 11-26 and 64-115. `references/authentication-proxy.instructions.md` 16-49, 126-141
    and 290-303. All become qualified sentences, with the address `NEXT_PUBLIC_BUILDPAD_DAAS_URL`.
    Uses ES-1, ES-3, ES-4, ES-5 and ES-6 in their "On an Engine project" form.
  - Done when: FD holds for `authentication-proxy`, with one `text` entry per changed file.
  - _Requirements: 3.3, 3.5, 3.8, 3.16, 4.5, 4.6, 5.2, 2.4_
  - _Boundary: authentication-proxy/, converted/authentication-proxy, supabase-view-changes/authentication-proxy.json_
- [ ] 6.5 (P) Reword `buildpad-reference` (row 15, RW)
  - `SKILL.md` 11, 43-52 (asset URL) and 109-126. `references/react-components.instructions.md`
    15-19, 373 and 404-422. Uses ES-2 (the DaaSProvider token is a session token) and ES-11.
  - Done when: FD holds for `buildpad-reference`.
  - _Requirements: 3.11, 5.2, 2.4_
  - _Boundary: buildpad-reference/, converted/buildpad-reference, supabase-view-changes/buildpad-reference.json_
- [ ] 6.6 (P) Reword `create-feature` (row 18, RW)
  - `SKILL.md` 27, 41-45, 62 and 106-141. `references/vform-usage.instructions.md` 177-216. Qualified
    sentences: scope inside the tenant (ES-9), the module-access check through
    `/api/permissions/me` (ES-16), and the cron body per ES-10.
  - Done when: FD holds for `create-feature`.
  - _Requirements: 3.9, 3.10, 5.2, 2.4_
  - _Boundary: create-feature/, converted/create-feature, supabase-view-changes/create-feature.json_
- [ ] 6.7 (P) Reword `add-multitenancy` (row 32, RW)
  - `SKILL.md` 9-13. `references/multitenancy.instructions.md` 4 and 9-13. Qualified ES-9; the scoped
    collection column has a foreign key to `daas_scope_items(uri_path)`.
  - Done when: FD holds for `add-multitenancy`, and R4 reports no marker in this `wording only`
    folder.
  - _Requirements: 3.9, 5.2, 2.4_
  - _Boundary: add-multitenancy/, converted/add-multitenancy, supabase-view-changes/add-multitenancy.json_
- [ ] 6.8 (P) Reword `buildpad-steering-custom` and add its Gate (row 33, RW+G)
  - `SKILL.md`: the Gate placed by S4. Lines 43-51 become "record the backend the Gate established;
    never infer it from dependency or variable names". The templates and `rules/` stay unchanged.
  - Done when: FD holds for `buildpad-steering-custom`, and R8 reports nothing for its
    `settings-templates/` and `rules/`.
  - _Requirements: 1.2, 5.2, 5.6, 2.4_
  - _Boundary: buildpad-steering-custom/, converted/buildpad-steering-custom, supabase-view-changes/buildpad-steering-custom.json_
- [ ] 6.9 (P) Reword `context-engineering` (row 34, RW)
  - `SKILL.md` 42, 57-61, 73, 84 and 106. Qualified sentences: one Engine address for data and
    sign-in; the Engine MCP has no extensions tool.
  - Done when: FD holds for `context-engineering`.
  - _Requirements: 3.3, 5.2, 2.4_
  - _Boundary: context-engineering/, converted/context-engineering, supabase-view-changes/context-engineering.json_
- [ ] 6.10 (P) Reword `create-form-builder` (row 35, RW)
  - `SKILL.md` 20-34, 52-54 and 137-150. `references/form-builder.instructions.md` 78-106. Qualified
    sentences: the `limit` cap is 1000; delete answers 204; structure goes through
    `create-collection`, and `create-migration` applies on a Supabase project only.
  - Done when: FD holds for `create-form-builder`.
  - _Requirements: 3.6, 5.2, 2.4_
  - _Boundary: create-form-builder/, converted/create-form-builder, supabase-view-changes/create-form-builder.json_
- [ ] 6.11 (P) Reword `idea-refine` (row 36, RW)
  - `SKILL.md` 66 and 75-84 become "Next.js and the project's Buildpad backend"; scope sits inside
    the tenant.
  - Done when: FD holds for `idea-refine`.
  - _Requirements: 3.9, 5.2, 2.4_
  - _Boundary: idea-refine/, converted/idea-refine, supabase-view-changes/idea-refine.json_
- [ ] 6.12 (P) Reword `incremental-implementation` (row 37, RW)
  - `SKILL.md` 45 and 133: the first step defines the collection (`create-collection`).
  - Done when: FD holds for `incremental-implementation`.
  - _Requirements: 3.6, 5.2, 2.4_
  - _Boundary: incremental-implementation/, converted/incremental-implementation, supabase-view-changes/incremental-implementation.json_
- [ ] 6.13 (P) Reword `performance-optimization` (row 38, RW)
  - `SKILL.md` 56, 63-72, 106 and 126-128. Qualified sentences: indexing through an indexed field;
    `limit` capped at 1000.
  - Done when: FD holds for `performance-optimization`.
  - _Requirements: 5.2, 2.4_
  - _Boundary: performance-optimization/, converted/performance-optimization, supabase-view-changes/performance-optimization.json_
- [ ] 6.14 (P) Reword `planning-and-task-breakdown` (row 39, RW)
  - `SKILL.md` 29, 43, 60-67, 71-75 and 85-127: "define the collection through `create-collection`".
    Reword the line-62 example path, the one R1 hit outside a planned `supabase` range.
  - Done when: FD holds for `planning-and-task-breakdown`, and R1 reports nothing at `SKILL.md:62`.
  - _Requirements: 3.1, 3.6, 5.2, 2.4_
  - _Boundary: planning-and-task-breakdown/, converted/planning-and-task-breakdown, supabase-view-changes/planning-and-task-breakdown.json_
- [ ] 6.15 (P) Reword `review-code` (row 40, RW)
  - `SKILL.md` 11, 24, 27 and 34-36. Qualified sentences: on an Engine project, any Supabase client
    call other than sign-in has no server, and any service-role key reference is a finding.
  - Done when: FD holds for `review-code`.
  - _Requirements: 3.4, 5.2, 2.4_
  - _Boundary: review-code/, converted/review-code, supabase-view-changes/review-code.json_
- [ ] 6.16 (P) Reword `spec-driven-development` (row 41, RW)
  - `SKILL.md` 47-53: the scope hierarchy sits beneath the tenant.
  - Done when: FD holds for `spec-driven-development`.
  - _Requirements: 3.9, 5.2, 2.4_
  - _Boundary: spec-driven-development/, converted/spec-driven-development, supabase-view-changes/spec-driven-development.json_
- [ ] 6.17 (P) Reword `subagent-delegation` (row 42, RW)
  - `SKILL.md` 18, 30 and 58: the OAuth review is not available on an Engine project.
  - Done when: FD holds for `subagent-delegation`.
  - _Requirements: 4.1, 5.2, 2.4_
  - _Boundary: subagent-delegation/, converted/subagent-delegation, supabase-view-changes/subagent-delegation.json_
- [ ] 6.18 (P) Reword `buildpad-steering` and add its Gate (row 43, RW+G)
  - `SKILL.md`: the Gate, and lines 53-56 reworded as in 6.8. The templates and `rules/` stay
    unchanged.
  - Done when: FD holds for `buildpad-steering`, and R8 reports nothing for its `settings-templates/`
    and `rules/`.
  - _Requirements: 1.2, 5.2, 5.6, 2.4_
  - _Boundary: buildpad-steering/, converted/buildpad-steering, supabase-view-changes/buildpad-steering.json_

- [ ] 7. Convert the core Skills (design Group 2; after task 4)
- [ ] 7.1 (P) Convert `add-external-oauth` (row 1, US)
  - `SKILL.md`: the Gate after the H1, then S7-A verbatim. The sup passage is the rest of the body
    (9-683). The description is reworded to "stops on an Engine project" (C4).
    `references/oauth-implementation.instructions.md` becomes file:sup.
  - Done when: FD holds for `add-external-oauth`. The Engine view is the Gate plus S7-A only, and
    names `add-users`.
  - _Requirements: 1.2, 1.9, 2.1, 4.1, 4.2, 4.8, 3.15, 2.4_
  - _Boundary: add-external-oauth/, converted/add-external-oauth, supabase-view-changes/add-external-oauth.json_
- [ ] 7.2 Convert `create-api-route` into a separate Engine file set (row 2, EF)
  - `SKILL.md`: the Gate. The sup passage is body 9-115 verbatim. The eng passage is a new body with
    the forwarder template, linking the Engine file. Its description is reworded (C4).
    `references/api-routes.instructions.md` and `references/api-authorization.instructions.md`
    become file:sup.
  - New `references/engine-api-routes.instructions.md`: the `engine` file marker and the Gate. Every
    data route forwards `Authorization` to `<Engine_URL>/api/...` via `getAuthHeaders()`/`getDaasUrl()`
    and passes the status and `{errors:[...]}` through. Sections: items (with the `X-Resource-Uri`
    passthrough), workflow transition, users me, files and signed URL (ES-11), permissions,
    versions, and local utilities. Uses ES-1, ES-2, ES-4, ES-5 and ES-16, with no table,
    remote-procedure or service-role guidance.
  - Done when: FD holds for `create-api-route`, and R1 and R6b report nothing for the Engine file.
  - Not (P): it file-marks `api-routes.instructions.md`, which 4.2 links.
  - _Requirements: 1.2, 1.3, 1.9, 2.1, 3.3, 3.11, 5.3, 5.4, 3.15, 2.4_
  - _Depends: 4.2_
- [ ] 7.3 (P) Convert `create-migration` (row 3, US)
  - `SKILL.md`: the Gate after the H1, then S7-B verbatim, before any step. The sup passage is the
    rest (9-101). The description is reworded (C4). `references/special-fields.instructions.md`
    becomes file:sup.
  - Done when: FD holds for `create-migration`. In the Engine view, S7-B is the first content after
    the Gate and names `create-collection`, `create-rbac`, `relational-permissions`,
    `create-workflow` and `manage-scope`.
  - _Requirements: 1.2, 1.9, 2.1, 4.3, 4.4, 4.8, 3.15, 2.4_
  - _Boundary: create-migration/, converted/create-migration, supabase-view-changes/create-migration.json_

- [ ] 8. Convert the automation Skills (design Group 4; after tasks 4 and 5)
- [ ] 8.1 (P) Convert `add-cron` (row 5, BP)
  - `SKILL.md` 32-41 (address, CORS), 171, 194 (an eng passage with ES-6 after the `mfaRequired`
    error kind), 203 and 213.
  - Engine content: ES-1, ES-15, ES-13n and ES-6, and a pointer to `create-cron/SKILL.md` for the
    Engine runtime.
  - Done when: FD holds for `add-cron`.
  - _Requirements: 1.2, 1.9, 2.1, 3.14, 4.6, 4.7, 3.15_
  - _Boundary: add-cron/, converted/add-cron, supabase-view-changes/add-cron.json_
- [ ] 8.2 (P) Convert `add-workflows` (row 12, BP)
  - `SKILL.md` 34-43, 158, 176 (an eng passage with ES-6 after the `mfaRequired` error kind) and 198,
    read at `origin/main`, which holds commit `873f492`.
  - Engine content: ES-1, ES-15 and ES-6. Instance writes go only through
    `POST /api/workflow/transition`.
  - Done when: FD holds for `add-workflows`.
  - _Requirements: 1.2, 1.9, 2.1, 4.6, 3.15_
  - _Boundary: add-workflows/, converted/add-workflows, supabase-view-changes/add-workflows.json_
- [ ] 8.3 (P) Convert `create-cron` (row 17, BP)
  - `SKILL.md` 13, 28-83 (MCP `cron` calls, sup), 104-168, 212, 240-318 and 323 (link, sup).
    `references/cron-mcp.instructions.md` becomes file:sup (no `cron` tool, PP-29).
    `references/cron-sandbox.instructions.md` 18-128 and 234-312, with the link at 59 moved into sup.
    `references/cron-api.instructions.md` 10, 90-108, 112-224 and 262-294.
  - Engine content: create through the Studio's Cron module or `POST <Engine_URL>/api/cron` (also
    `/:id`, `/run`, `/clone`, `/history`). Also ES-2 (never the MCP token), ES-10 and ES-13n. The log
    line format is `[<time>] [INFO|WARN|ERROR] <message>`. `memory_limit_mb` is not enforced.
  - Done when: FD holds for `create-cron`. Every `x-pp29-tool` hit lies in `supabase` text, and
    cron-sandbox's link at 59 lies inside a `supabase` passage.
  - _Requirements: 1.2, 1.9, 2.1, 3.1, 3.2, 3.10, 3.14, 4.7, 3.15_
  - _Depends: 5.8_
  - _Boundary: create-cron/, converted/create-cron, supabase-view-changes/create-cron.json_
- [ ] 8.4 (P) Convert `create-service` (row 21, BP)
  - `SKILL.md` 19, 28-79 (MCP `services`, sup), 97-111, 141-150 (link 145, sup), 199-302, 365 and 374
    (link, sup). `references/custom-services.instructions.md` 90-155, 157-237, 265-337 and 393-427.
    `references/stripe.instructions.md` 10-47.
  - Engine content: create through the Studio or `POST <Engine_URL>/api/services`; tests use
    `POST /api/services/:id/tests`, and `data.status` decides. Also ES-2 and ES-10 (no `console` in a
    body, no `Intl`). The key goes on the env whitelist, and `api.stripe.com` in the allowed domains.
  - Done when: FD holds for `create-service`, and the links at 145 and 374 lie inside `supabase`
    passages.
  - _Requirements: 1.2, 1.9, 2.1, 3.2, 3.10, 3.15_
  - _Boundary: create-service/, converted/create-service, supabase-view-changes/create-service.json_
- [ ] 8.5 Convert `hooks-extensions` into a separate Engine file set (row 27, EF)
  - `SKILL.md`: the Gate after the H1. The sup passage is body 9-225 verbatim. The eng passage is a
    new body linking the three Engine files. The three existing references become file:sup.
  - New `references/engine-hooks.instructions.md`, `references/engine-services-api.instructions.md`
    and `references/engine-utilities-api.instructions.md` get the `engine` file marker and the Gate.
    With the new body they cover the lines that differ at `7ed910f` (row 27): `SKILL.md` 20-84, 93
    and 114-172; `hooks-extensions` 18, 48-83, 187-235, 253-369 and 422-560; `services-api` 32-151,
    176-415 and 447-639; `utilities-api` 56-390 and 484-491.
  - Engine content: create through the Studio or `/api/extensions` (activate, deactivate, clone).
    There is no test route: activate and write a scratch item. Event names are `items.*` and
    `<collection>.items.*`. ES-10 in full. Utilities accept a session token only.
  - Done when: FD holds for `hooks-extensions`, and R6b reports no broken link anywhere into its
    references.
  - Not (P): it file-marks targets linked from 4.4, 5.8, 8.3 and 8.4.
  - _Requirements: 1.2, 1.3, 1.9, 2.1, 3.1, 3.10, 5.3, 3.15_
  - _Depends: 4.4, 5.8, 8.3, 8.4_

- [ ] 9. Release `v2.0.0` (design "Last"; after tasks 4 to 8)
- [ ] 9.1 Run the release read-through and the install check on the candidate
  - Run `node tools/repo-check/check.mjs --render <out>` and go through Testing Strategy steps 2 to 5
    for all 44 changed folders. Gather the per-folder read-through records from the pull requests.
    Confirm that R7 reports no UC folder (rows 45-64).
  - Install check: `npx skills@1.7.1 add <local checkout> --all` into a scratch folder. The installed
    files must equal the candidate tree.
  - Done when: there is no open finding, and reader, date and candidate commit are noted for 9.2.
  - _Requirements: 1.8, 2.2, 2.3, 3.15, 6.7_
- [ ] 9.2 Write `CHANGELOG.md` and release every change-file entry
  - Add a `v2.0.0` section to `CHANGELOG.md`, above the `v1.0.0` section from 3.2. It has a "Supabase projects" subsection that lists every entry of
    `supabase-view-changes/*.json` with its reason, including every reworded description, and a
    "Read through by" line from 9.1. Set each entry's `release` to `v2.0.0`. After 3.2 created the
    file, this is the only task that edits `CHANGELOG.md` before task 10.
  - Done when: `node tools/repo-check/check.mjs --tag v2.0.0` exits 0, which means R10 and R13 pass
    with no `unreleased` entry and every non-UC row converted. The pull request is merged.
  - _Requirements: 2.4, 6.2, 7.1, 7.2_
- [ ] 9.3 Tag `v2.0.0` and publish the GitHub Release (maintainer)
  - Create the annotated tag `v2.0.0` on the merge commit of 9.2, push it, and publish a GitHub
    Release carrying the `v2.0.0` CHANGELOG section.
  - Then install the tag into a scratch folder with `npx skills@1.7.1 add buildpad-ai/skills#v2.0.0@create-project`
    and `#v2.0.0 --all`.
  - Done when: the tag-push CI run is green (R10, R13), the release page exists, and the installed
    files equal `git ls-tree -r v2.0.0` for those paths.
  - _Requirements: 6.2, 6.3_
  - External note: the Platform does not re-sync until `v2.0.0`. Its `pnpm sync:skills --ref v2.0.0`
    and `skills-vendor.json` are the Platform's work (SP-2, PP-39), not tasks here.

- [ ] 10. External gates: switch each "not yet available" statement when its dependency is met
  - Each sub-task stays blocked until its row is recorded as met in the requirements' Dependencies,
    by a dated amendment that the maintainer approves. It edits only the folders named, and its own
    change-file entries. Each one ships in a release written by 10.8.

  | Row (owner) | Statement now | Later form | Folders | Sub-task |
  |---|---|---|---|---|
  | Decision P scheduler running (infra Req. 2 crit. 14) | ES-13n | ES-13m | add-cron, create-cron | 10.1 |
  | PP-30 Worker_Token on the data API (Engine); PP-16 permission over later collections | ES-14n | ES-14m | worker-messaging | 10.2 |
  | Decision Y PP-35 one session, several holders (Engine) | NY stop text | Engine steps | add-microfrontend, add-microfrontend-zones | 10.3 |
  | PP-29 `cron`, `services`, `extensions` MCP tools (Engine) | Studio/REST only; `x-pp29-tool` guard | MCP steps | create-cron, create-service, hooks-extensions, daas-platform | 10.4 |
  | PP-28 `X-Tenant-Id` cross-origin (Engine, infra Decision 7; not in Dependencies) | ES-4, ES-11 server-side sign-in, signed URLs | browser may name the tenant | every folder carrying ES-4/ES-11 | 10.5 |
  | PP-21, PP-34, PP-36 (`buildpad-ui`) | ES-16 | generated modules usable | folders carrying ES-16 | 10.6 |
  | EP-21, EP-24, EP-28, MCP `schema` block (Engine; not in Dependencies, Issue 6) | facts in rows 6, 15, 16, 20, 30; ES-8 | facts revised | those rows | 10.7 |

- [ ] 10.1 Switch ES-13n to ES-13m once the scheduler is listed available
  - Blocked until: row Decision P is recorded as met (a creation path runs the scheduler, infra
    Requirement 2 criterion 14). No design revision needed: ES-13m is worded.
  - In `add-cron` and `create-cron`, replace each ES-13n with ES-13m verbatim, and remove "run by
    hand only" from the Engine text.
  - Done when: `git grep -n "does not run yet" add-cron create-cron` finds nothing, and both test
    runs and `check.mjs` exit 0.
  - _Requirements: 3.14, 4.7_
- [ ] 10.2 Switch ES-14n to ES-14m once PP-30 (and PP-16) are met
  - Blocked until: rows Decision H (PP-30) and Decision AA (PP-16) are recorded as met. No design
    revision needed: ES-14m is worded.
  - In `worker-messaging`'s eng section, drop the last sentence of ES-14n.
  - Done when: the eng section equals ES-14m, and both test runs and `check.mjs` exit 0.
  - _Requirements: 5.7, 5.9, 4.7_
- [ ] 10.3 Write the Engine steps of the microfrontend Skills once PP-35 is met
  - Blocked until: row Decision Y, PP-35 is recorded as met, and the design revision below is
    approved.
  - First, a design revision words the Engine session-sharing steps (the design does not word them
    yet). Then replace the NY stop text with eng passages, and add Engine assets with file markers
    and the Pointer.
  - Done when: the Engine views of both folders hold steps and no stop text, and both test runs and
    `check.mjs` exit 0.
  - _Requirements: 3.5, 4.7_
- [ ] 10.4 Add the MCP-tool paths once PP-29 is met
  - Blocked until: row PP-29 is recorded as met for the `cron`, `services` or `extensions` tool, and
    the design revision below is approved.
  - First, a design revision words them. Then add eng MCP steps in the four folders, and remove the
    `x-pp29-tool` patterns from `lib/guard.mjs` and `test/guard.test.mjs` for the tools now served.
  - Done when: guard tests pass without those patterns, and both test runs and `check.mjs` exit 0.
  - _Requirements: 3.1, 4.7_
- [ ] 10.5 Revise ES-4 and ES-11 once PP-28 is met
  - Blocked until: the Dependencies gain a row for PP-28 (the Engine allowing `X-Tenant-Id`
    cross-origin; it has none today, like Issue 6's gaps), that row is recorded as met, and the
    design revision below is approved.
  - First, a design revision words the new ES-4 and ES-11. Then replace them verbatim wherever they
    are copied.
  - Done when: `git grep` finds no copy of the old texts, and both test runs and `check.mjs` exit 0.
  - _Requirements: 3.8, 3.11_
- [ ] 10.6 Revise ES-16 once PP-21, PP-34 and PP-36 are met
  - Blocked until: rows Decision M, PP-21, PP-34 and PP-36 are recorded as met, and the design
    revision below is approved.
  - First, a design revision words the change. Then replace ES-16 verbatim in its folders.
  - Done when: no copy of the old ES-16 remains, and both test runs and `check.mjs` exit 0.
  - _Requirements: 3.1, 3.8, 5.4, 4.7_
- [ ] 10.7 Revise the Engine-gap facts once EP-21, EP-24, EP-28 or the MCP `schema` block change
  - Blocked until: the Dependencies hold rows for these gaps (Issue 6's proposal, a requirements
    amendment), the row in question is recorded as met, and a design revision words the revised
    facts.
  - First, the requirements' Dependencies gain rows for these (Issue 6's proposal) and a design
    revision words the revised facts. Then revise the facts in rows 6, 15, 16, 20 and 30 and in ES-8.
  - Done when: the revised facts match the Engine revision cited in the amendment, and both test
    runs and `check.mjs` exit 0.
  - _Requirements: 3.6, 3.11, 4.7_
- [ ] 10.8 Release each switch
  - For each merged switch, write its `CHANGELOG.md` section and set its entries' `release`. The tag
    is MINOR when only Engine text changed, MAJOR when a Supabase view changed (S9). The maintainer
    tags it and publishes the GitHub Release.
  - Done when: the tag-push CI run is green and the release page exists.
  - _Requirements: 6.2, 2.4_
