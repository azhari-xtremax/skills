# Context Discovery & Auto-Configuration

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

## Overview

Before creating or configuring any microapp, the agent MUST discover the full project context automatically using the `get_project_detail` platform MCP tool. This eliminates manual user input for URLs, credentials, and deployment targets.

## Step 0: Call `get_project_detail` (MANDATORY)

This is the **first action** in every microapp or microfrontend operation. The tool returns all project context from the authenticated MCP session:

```json
// Call the platform MCP tool — no arguments needed
{ "name": "get_project_detail", "arguments": {} }
```

### Response Schema

> This interface lists the fields these skills consume. **The response may contain
> more** — current platforms also return top-level `workers` (runtime background
> jobs) and `messaging` (queue connection details). Treat the schema as open: when a
> step says "every deployed origin", enumerate what is actually in the response, not
> just what is documented here.

<!-- buildpad-backend: supabase -->
```typescript
interface ProjectDetail {
  success: boolean;
  message: string;
  organization: {
    id: string; // UUID
    name: string; // e.g., "Acme Corp"
  };
  project: {
    id: string; // UUID
    name: string; // e.g., "my-project"
    description: string | null;
    mainGitUrl: string | null; // Git repo URL for Main App (includes credentials)
    mainGitToken: string | null; // Git token for cloning/pushing
    mainAmplifyUrl: string | null; // Resolved Amplify URL for Main App (e.g., https://main.d1234abcde.amplifyapp.com)
    supabaseUrl: string | null; // Shared Supabase URL
    supabaseAnonKey: string | null; // Shared Supabase anon key
    supabaseServiceRoleKey: string | null; // Shared Supabase service role key
    daasUrl: string | null; // Shared DaaS backend URL
    daasVersion: string | null; // DaaS version
    daasAdminEmail: string; // DaaS admin email
    daasAdminPassword: string | null; // DaaS admin password
    createdAt: string;
    updatedAt: string;
  };
  microapps: Array<{
    id: string; // UUID
    name: string; // e.g., "users-app"
    description: string | null;
    gitUrl: string | null; // Git repo URL for this microapp
    gitToken: string | null; // Git token (same as project token)
    amplifyUrl: string | null; // Resolved Amplify URL (e.g., https://main.d5678fghij.amplifyapp.com)
    createdAt: string;
    updatedAt: string;
  }>;
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
```typescript
interface ProjectDetail {
  success: boolean;
  message: string;
  organization: {
    id: string; // UUID
    name: string; // e.g., "Acme Corp"
  };
  project: {
    // An Engine project's project object holds no Supabase field, no service-role key and no password.
    id: string; // UUID
    name: string; // e.g., "my-project"
    description: string | null;
    mainGitUrl: string | null; // Git repo URL for Main App (includes credentials)
    mainGitToken: string | null; // Git token for cloning/pushing
    mainAmplifyUrl: string | null; // Resolved Amplify URL for Main App (e.g., https://main.d1234abcde.amplifyapp.com)
    projectBackend: 'engine'; // The project's backend
    engineUrl: string | null; // The Engine_URL: the shared data API and sign-in address
    daasUrl: string | null; // Also the Engine_URL on an Engine project
    studioUrl: string | null; // The Studio: an administration interface; send no data call to it
    daasVersion: string | null; // Engine version
    daasAdminEmail: string; // Studio administrator email
    projectTenantId: string | null; // The project's tenant id
    tenantVariable: string | null; // The variable that carries it: NEXT_PUBLIC_BUILDPAD_TENANT_ID
    publicAnonKey: string | null; // The fixed value for NEXT_PUBLIC_SUPABASE_ANON_KEY (not a secret)
  };
  microapps: Array<{
    id: string; // UUID
    name: string; // e.g., "users-app"
    description: string | null;
    gitUrl: string | null; // Git repo URL for this microapp
    gitToken: string | null; // Git token (same as project token)
    amplifyUrl: string | null; // Resolved Amplify URL (e.g., https://main.d5678fghij.amplifyapp.com)
    createdAt: string;
    updatedAt: string;
  }>;
}
```
<!-- /buildpad-backend -->

## Deriving Configuration from Context

Configuration is split in two:

<!-- buildpad-backend: supabase -->
| Category                                                          | Where it lives                            | Why                                                             |
| ----------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Infrastructure secrets (Supabase URL, keys, DaaS URL)             | `.env.local` and the Amplify console      | Sensitive. Never committed.                                      |
| Application URLs (Main App URL, micro-app URLs, host origin)      | `config/app-urls.ts`, committed to git    | Must exist at Amplify build time with no console configuration.  |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| Category                                                          | Where it lives                            | Why                                                             |
| ----------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Infrastructure values (Engine_URL, fixed anon value, tenant id)   | `.env.local` and the Amplify console      | Set once per app. Never committed.                               |
| Application URLs (Main App URL, micro-app URLs)                   | `config/app-urls.ts`, committed to git    | Must exist at Amplify build time with no console configuration.  |
<!-- /buildpad-backend -->

The file shapes, the generation rules, and the failure modes are in one place:
[app-urls config](app-urls-config.instructions.md).


### Service Registry (Auto-Generated `lib/services.ts`)

Generate the service registry from the microapps list, importing URLs from the committed config:

```typescript
// lib/services.ts — generated from the get_project_detail response.
import { MICROAPP_URLS } from '@/config/app-urls';

export const MICRO_APPS = {
  // AGENT: replace this block with one entry per item in microapps[].
  // Keep the shape exactly. Do not emit template syntax into a TypeScript file.
  'users-app': { url: MICROAPP_URLS['users-app'], label: 'Users' },
  'billing-app': { url: MICROAPP_URLS['billing-app'], label: 'Billing' },
} as const;

export type MicroAppKey = keyof typeof MICRO_APPS;
```

### Git Operations (Auto-Configured)

Clone microapp repos using the discovered git URL and token:

```bash
# Clone microapp — URL includes credentials from get_project_detail
git clone {{microapp.gitUrl}} /path/to/{{microapp.name}}

# Or if gitUrl doesn't include token, construct authenticated URL:
# git clone https://oauth2:{{project.mainGitToken}}@github.com/org/{{microapp.name}}.git
```

## Amplify URL Resolution

The `get_project_detail` tool resolves Amplify URLs from AWS Amplify app IDs stored in the platform database:

```
project.main_amplify_app_id → AWS Amplify API → https://main.{defaultDomain}
microapp.amplify_app_id → AWS Amplify API → https://main.{defaultDomain}
```

**Important:**

- If `amplifyUrl` is `null`, the Amplify app hasn't been created yet or the AWS credentials are not configured
- When `amplifyUrl` is null, the agent should note this and instruct the user to set up Amplify, or use a local dev URL as fallback
- Amplify URLs follow the pattern `https://main.d{random}.amplifyapp.com` for the default domain
- Custom domains may be configured separately in Amplify console

<!-- buildpad-backend: supabase -->
## Context-Aware Workflow

The complete automated workflow uses context discovery at every decision point:

```
1. Call get_project_detail
   ├── Extract project.daasUrl, project.supabaseUrl, etc. (shared infra)
   ├── Extract project.mainAmplifyUrl (Main App URL for HOST_ORIGIN)
   ├── Extract microapps[] (existing micro-apps)
   └── Extract mainGitUrl, mainGitToken (for git operations)

2. Determine what exists vs. what needs creation
   ├── Check if requested microapp name already exists in microapps[]
   ├── If exists: clone its gitUrl, configure env, continue development
   └── If new: bootstrap project, register microapp, set up Amplify

3. Auto-generate all configuration
   ├── .env.local for infrastructure vars (Supabase, DaaS — no user input)
   ├── config/app-urls.ts with deployed URLs (committed to git)
   ├── lib/services.ts importing from config/app-urls.ts
   └── amplify.yml (standard build spec)

4. Deploy via git push
   ├── Commit changes to microapp repo (includes config/app-urls.ts)
   ├── Push to main branch → triggers Amplify build
   └── Update Main App's config/app-urls.ts with new microapp URL → push → rebuild
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Context-Aware Workflow

The complete automated workflow uses context discovery at every decision point:

```
1. Call get_project_detail
   ├── Extract project.projectBackend ("engine")
   ├── Extract project.engineUrl, project.daasUrl (both the Engine_URL)
   ├── Extract project.projectTenantId, project.tenantVariable, project.publicAnonKey
   ├── Extract project.mainAmplifyUrl (Main App URL)
   ├── Extract microapps[] (existing micro-apps)
   └── Extract mainGitUrl, mainGitToken (for git operations)

2. Determine what exists vs. what needs creation
   ├── Check if requested microapp name already exists in microapps[]
   ├── If exists: clone its gitUrl, configure env, continue development
   └── If new: bootstrap project, register microapp, set up Amplify

3. Auto-generate all configuration
   ├── .env.local with the same four values in every app (Engine_URL, anon value, tenant id — no user input)
   ├── config/app-urls.ts with deployed URLs (committed to git)
   ├── lib/services.ts importing from config/app-urls.ts
   └── amplify.yml (standard build spec)

4. Deploy via git push
   ├── Commit changes to microapp repo (includes config/app-urls.ts)
   ├── Push to main branch → triggers Amplify build
   └── Update Main App's config/app-urls.ts with new microapp URL → push → rebuild
```
<!-- /buildpad-backend -->

## Validation Checklist

After context discovery, verify:

<!-- buildpad-backend: supabase -->
- [ ] `project.daasUrl` is not null (DaaS backend must exist)
- [ ] `project.supabaseUrl` is not null (Supabase must be configured)
- [ ] `project.supabaseAnonKey` is not null
- [ ] `project.mainAmplifyUrl` is not null (Main App must be deployed)
- [ ] Microapp `amplifyUrl` is resolved (or marked as pending if new)
- [ ] `project.mainGitToken` is available for git operations
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
- [ ] `project.projectBackend` is `"engine"` (if not, tell the developer it disagrees with the backend established for this project)
- [ ] `project.engineUrl` and `project.daasUrl` are not null (both are the Engine_URL)
- [ ] `project.projectTenantId` is not null
- [ ] `project.tenantVariable` and `project.publicAnonKey` are present
- [ ] `project.mainAmplifyUrl` is not null (Main App must be deployed)
- [ ] Microapp `amplifyUrl` is resolved (or marked as pending if new)
- [ ] `project.mainGitToken` is available for git operations

An Engine project has no Supabase address or key: never stop because one is absent.
<!-- /buildpad-backend -->

If any critical value is missing, report it to the user with a specific remediation step rather than proceeding with placeholders.

## Anti-Patterns

<!-- buildpad-backend: supabase -->
| Anti-Pattern                         | Why It's Bad                                      | Correct Approach                        |
| ------------------------------------ | ------------------------------------------------- | --------------------------------------- |
| Asking user for DaaS URL             | Already available via `get_project_detail`        | Auto-discover from context              |
| Hardcoding `example.com` URLs        | Breaks in real deployments                        | Use `amplifyUrl` from context           |
| Asking user for Supabase credentials | Already in project context                        | Auto-populate from `get_project_detail` |
| Skipping context discovery           | All subsequent steps use wrong/placeholder values | Always call `get_project_detail` first  |
| Using placeholder env vars           | App won't connect to real backend                 | Derive all from context response        |
| Manually constructing Amplify URLs   | URL format may change                             | Use resolved `amplifyUrl` from tool     |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| Anti-Pattern                                | Why It's Bad                                      | Correct Approach                        |
| ------------------------------------------- | ------------------------------------------------- | --------------------------------------- |
| Asking user for DaaS URL                    | Already available via `get_project_detail`        | Auto-discover from context              |
| Hardcoding `example.com` URLs               | Breaks in real deployments                        | Use `amplifyUrl` from context           |
| Asking user for the Engine_URL or tenant id | Already in project context                        | Auto-populate from `get_project_detail` |
| Stopping because a Supabase value is absent | An Engine project has none                        | Read the Engine fields (Step 0)         |
| Skipping context discovery                  | All subsequent steps use wrong/placeholder values | Always call `get_project_detail` first  |
| Using placeholder env vars                  | App won't connect to real backend                 | Derive all from context response        |
| Manually constructing Amplify URLs          | URL format may change                             | Use resolved `amplifyUrl` from tool     |
<!-- /buildpad-backend -->
