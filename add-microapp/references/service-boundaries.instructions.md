# Service Boundary Patterns

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

In this architecture, all micro-apps share a **single DaaS backend**. A service boundary defines which **collections** a team or micro-app is responsible for — not which DaaS instance they use. Boundaries are logical (team ownership, code organization) rather than physical (separate databases).

## Collection-Based Domain Boundaries

Each micro-app maps to a **bounded context** — a cohesive set of collections managed by one team within the shared DaaS:

| Micro-App     | Bounded Context    | Collections (in shared DaaS)                     |
| ------------- | ------------------ | ------------------------------------------------ |
| Main App      | Core / Settings    | `settings`, `dashboard_widgets`, `announcements` |
| Users         | Identity & Access  | `profiles`, `roles`, `user_preferences`          |
| Billing       | Financial          | `invoices`, `payments`, `plans`, `subscriptions` |
| Analytics     | Reporting          | `events`, `reports`, `dashboards`                |
| Content       | Content Management | `pages`, `articles`, `media`, `categories`       |
| Notifications | Communication      | `notifications`, `templates`, `delivery_logs`    |

### How to Identify Boundaries

1. **Collections that change together** → same micro-app domain
2. **Collections that are queried together** (JOINs, relations) → same micro-app domain
3. **Teams that own them** → align with team structure
4. **UI screens that use them** → same micro-app

### Anti-Patterns

- **Overlapping ownership**: Two micro-apps both writing to the same collection — assign clear ownership
- **Nano-services**: One collection per micro-app — too much overhead
- **Circular dependencies**: App A depends on App B's collections which depend on App A's collections
- **A proxy route for a Buildpad component**: Buildpad components call DaaS through `DaaSProvider`. Add a proxy route only for hand-written fetches.

## Shared DaaS Instance

All apps connect to the same DaaS backend:

```
Main App       ─┐
Users App      ─┤──→  https://your-project.buildpad-daas.xtremax.com
Billing App    ─┤     (single instance, all collections)
Analytics App  ─┘
```

The shared DaaS instance contains:

- **All collections** from all domain boundaries
- **Shared RBAC** (roles and permissions apply across all collections)
- **Shared runtime extensions** (hooks for validation, audit, etc.)
- **Relational fields** that can link collections across domain boundaries

## Collection Naming

Use domain prefixes when collections might have ambiguous names, or no prefix when names are naturally unique:

```
// Naturally unique — no prefix needed
profiles
invoices
events
reports

// Ambiguous — use domain prefix
billing_plans       (vs. subscription_plans)
user_preferences    (vs. notification_preferences)
billing_settings    (vs. app_settings)
```

Document ownership in collection `meta.note`:

```json
{
  "collection": "invoices",
  "meta": { "note": "Owned by Billing team. Contact: billing-team@example.com" }
}
```

## Shared vs. Domain-Specific Data

<!-- buildpad-backend: supabase -->
| Data Type              | Lives In Collection | Accessed By             |
| ---------------------- | ------------------- | ----------------------- |
| Auth (users, sessions) | Supabase Auth       | All apps (middleware)   |
| User profiles          | `profiles`          | All apps (via DaaS)     |
| Invoices               | `invoices`          | Billing app primarily   |
| Analytics events       | `events`            | Analytics app primarily |
| App settings           | `settings`          | Main App primarily      |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
| Data Type              | Lives In Collection | Accessed By             |
| ---------------------- | ------------------- | ----------------------- |
| Auth (users, sessions) | The Engine          | All apps (middleware)   |
| User profiles          | `profiles`          | All apps (via DaaS)     |
| Invoices               | `invoices`          | Billing app primarily   |
| Analytics events       | `events`            | Analytics app primarily |
| App settings           | `settings`          | Main App primarily      |
<!-- /buildpad-backend -->

**Any app can read any collection** (subject to RBAC). The "ownership" is about who manages the schema and business logic, not who can access the data.

## Cross-Domain Data Access

Since all collections are in the same DaaS instance, cross-domain access is simple:

```typescript
// Billing app fetching user profile — call DaaS directly
import { buildApiUrl, getApiHeaders } from '@/lib/buildpad/services';

const profile = await fetch(buildApiUrl('/api/items/profiles/user-123'), {
  headers: getApiHeaders()
}).then((r) => r.json());

// Even better: use DaaS relational fields
const invoice = await fetch(
  buildApiUrl('/api/items/invoices/inv-001?fields=*,user_id.display_name,user_id.email'),
  { headers: getApiHeaders() }
).then((r) => r.json());
// Returns invoice with nested user data in one request
```

**No API-to-API calls needed** — this is a key advantage of the single shared DaaS architecture.

## Relational Fields Across Domains

DaaS relational fields (M2O, O2M, M2M) work naturally across domain boundaries because all collections are in the same instance:

```json
// invoices collection has a M2O relation to profiles
// mcp_daas_fields -> action: create
// Setting meta.options.related_collection auto-creates the FK constraint + daas_relations row
{
  "collection": "invoices",
  "field": "user_id",
  "type": "uuid",
  "meta": {
    "interface": "list-m2o",
    "special": ["m2o"],
    "options": {
      "related_collection": "profiles",
      "on_delete": "SET NULL"
    }
  }
}
```

This allows fetching related data across domains with DaaS's built-in deep query:

```
GET /items/invoices?fields=*,user_id.display_name&filter[status][_eq]=paid
```

## RBAC: Centralized Permission Boundaries

Roles and permissions are defined once and apply across all collections:

```
Role: "admin"
  → CRUD on ALL collections

Role: "billing_manager"
  → CRUD on invoices, payments, plans
  → Read-only on profiles (for displaying user info)
  → No access to events, reports

Role: "viewer"
  → Read-only on all collections
```

The DaaS backend enforces these permissions on every request, regardless of which app (Main or micro) made the request. This means:

- A billing_manager using the Users micro-app can only read profiles, not edit them
- The same billing_manager using the Billing micro-app has full CRUD on invoices
- RBAC is enforced server-side — the micro-app UI adapts by checking the user's role

## Schema Coordination

Since all apps share the schema, coordinate changes:

<!-- buildpad-backend: supabase -->
1. **Adding a new collection**: The owning team creates it via MCP tools, documents in shared-types
2. **Adding fields**: The owning team adds fields; consuming apps update their TypeScript types
3. **Breaking changes**: Notify all teams, update shared-types package, version the change
4. **Migrations**: Use DaaS schema management (not Supabase migrations) for collection changes
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
1. **Adding a new collection**: The owning team creates it via MCP tools, documents in shared-types
2. **Adding fields**: The owning team adds fields; consuming apps update their TypeScript types
3. **Breaking changes**: Notify all teams, update shared-types package, version the change
4. **No migrations**: An Engine project has no database migrations. Change collections and fields through the Engine's API or its MCP tools (the `create-collection` skill), never through a migration file
<!-- /buildpad-backend -->

```
Team adds field to 'profiles' collection
  → Update packages/shared-types/src/users.ts
  → Notify consuming teams (Billing may display user data)
  → All apps pull latest shared-types
```
