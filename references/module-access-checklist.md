<!-- backend-gate:begin v1 -->
**Establish the backend first.** A Buildpad project's backend is either the Buildpad Engine or
Supabase, and some parts of this file hold for one of them only. Before you act on anything in
this file, find the backend with these steps, in order, and stop at the first step that answers:

1. Read `.buildpad/project.json` at the project root. If it is JSON and its field `backend` is
   `"engine"` or `"supabase"`, that is the backend. If `.buildpad/backend-answer.json` names the
   other backend, tell the developer the two files disagree, and follow `.buildpad/project.json`.
2. Otherwise read `.buildpad/backend-answer.json` in the same way; if its `backend` is
   `"engine"` or `"supabase"`, that is the backend.
3. If a folder named `supabase` at the project root holds a file named `config.toml`, or holds a
   folder named `migrations` that holds a file whose name ends in `.sql`, the backend is Supabase.
4. Otherwise ask the developer once: "Is this project's backend the Buildpad Engine or
   Supabase?" Write the answer to `.buildpad/backend-answer.json` as
   `{"buildpadBackendAnswer": 1, "backend": "engine"}` or
   `{"buildpadBackendAnswer": 1, "backend": "supabase"}`, and ask the developer to commit that
   file. Do not add it to `.gitignore`. Never write `.buildpad/project.json`.

To find the backend, do not open an environment file (`.env`, `.env.*`) or an MCP configuration
file, and do not call a tool that returns project credentials.

Then follow only the parts for that backend. A part starts at a line that holds only a comment
whose text is `buildpad` + `-backend: engine` or `buildpad` + `-backend: supabase`, and ends at the
next line that holds only a comment whose text is `/buildpad` + `-backend`. A comment that merely
mentions a backend is not a part. A file whose first line, after any front matter, holds only a
comment whose text is `buildpad` + `-backend-file: engine` (or `supabase`) holds for that backend
only, and so does every file in a folder named `engine-only` or `supabase-only`. Skip the other
backend's parts and copy no code from them; everything else holds for both. On an Engine project, when this file says that
something is not available, tell the developer so and stop: do not build a substitute.
<!-- backend-gate:end -->

# Module Access Checklist

Use this checklist whenever a feature has role-gated behavior.

## Pre-Implementation

- [ ] Capability keys are defined using `<domain>:<capability>` naming
- [ ] Keys are registered in `daas_module_access_keys`
- [ ] Keys are granted in policy `module_access` maps
- [ ] Capability matrix is prepared (key, policies, UI guards, API guards)

## Implementation

- [ ] React gating uses `usePermissions().hasModuleAccess(key)`
<!-- buildpad-backend: supabase -->
- [ ] API routes enforce module access server-side (policy OR-merge)
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
- [ ] API routes enforce module access server-side. On an Engine project some files the Buildpad CLI generates cannot be used yet: `lib/supabase/admin.ts`, the OAuth callback and provider routes of the `external-oauth` module, the server-side enforcer and session modules, and `lib/module-access/enforce.ts`. Do not call them; check module access by forwarding the user's token to `GET <Engine_URL>/api/permissions/me` and reading `isAdmin` and `moduleAccess`. For My Apps sign-in the CLI installs the `external-oauth-engine` module in place of `external-oauth`; its routes are used as the `add-external-oauth` skill says.
<!-- /buildpad-backend -->
- [ ] Workflow commands use `module_access_keys` where applicable
- [ ] No raw role-name checks for capability gating

## Anti-Pattern Scan

Run both commands:

```bash
grep -rn "role === \|roleName\|user\.role\|is_manager\|is_admin\|isManager\b\|currentUser\.role" app/ components/ 2>/dev/null
grep -rn "detectAdminFromMe\|checkAdmin\|roleObj\.name === 'Administrator'\|admin_access\s*===\s*true\|\bisAdmin\b" app/ components/ 2>/dev/null
```

- [ ] Any match used as a capability gate is replaced with module-access checks

## Verification Tests

- [ ] Granted user path passes
- [ ] Ungranted UI path blocked
- [ ] Ungranted API path blocked with `403`
- [ ] Admin bypass path passes
