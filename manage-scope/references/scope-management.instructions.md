---
name: Scope Management
description: Complete MCP reference for DaaS native scope system — types, items, collection configs, user-role assignments, resource URI format, and ScopeSwitcher component usage.
applyTo: "**/*.{ts,tsx}"
---

<!-- buildpad-backend-file: supabase -->
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

# Scope Management Instructions

The DaaS scope system provides hierarchical multi-tenancy using `daas_scope_types` (hierarchy levels) and `daas_scope_items` (concrete instances). All setup is performed via the `scope` MCP tool. The active scope for any API request is communicated via the `X-Resource-Uri` header or `daas_resource_uri` cookie.

---

## Resource URI Format

Every scope item has a computed `uri_path` built from its ancestry:

```
/<type1-uuid>:<item1-uuid>/<type2-uuid>:<item2-uuid>/...
```

**Examples:**

| Level                  | uri_path                                                |
| ---------------------- | ------------------------------------------------------- |
| Root (Region = APAC)   | `/<region-type-id>:<apac-id>`                           |
| Child (Branch = SGP)   | `/<region-type-id>:<apac-id>/<branch-type-id>:<sgp-id>` |
| Grandchild (Floor)     | `/<region-id>:<apac-id>/<branch-id>:<sgp-id>/<floor-id>:<f1-id>` |

**Rules:**
- No trailing slash
- Segments separated by `/`
- Each segment is `<type-uuid>:<item-uuid>`
- Ancestors are a prefix of the child URI — `URI.startsWith(parentURI + '/')` or `URI === parentURI`

---

## MCP Tool: `scope` — Complete Action Reference

All actions require admin context. The tool is registered as `mcp_daas_scope`.

### Scope Types

#### `create_type`

Create a hierarchy level.

```json
{
  "action": "create_type",
  "name": "Region",
  "description": "Top-level geographic grouping",
  "level": 0,
  "meta": {}
}
```

| Field         | Type    | Required | Notes                                           |
| ------------- | ------- | -------- | ----------------------------------------------- |
| `name`        | string  | ✓        | Display name                                    |
| `description` | string  |          | Human-readable purpose                          |
| `level`       | integer | ✓        | 0 = root, 1 = first child, etc. Must be unique  |
| `meta`        | object  |          | Arbitrary metadata (icon, color, etc.)          |

#### `read_types`

```json
{
  "action": "read_types"
}
```

Returns array of all types ordered by `level`. Use to get UUIDs for `create_item`.

#### `update_type`

```json
{
  "action": "update_type",
  "id": "<type-uuid>",
  "name": "Geography",
  "description": "Updated label"
}
```

#### `delete_type`

```json
{
  "action": "delete_type",
  "id": "<type-uuid>"
}
```

> Only safe when no items of this type exist.

---

### Scope Items

#### `create_item`

```json
{
  "action": "create_item",
  "type_id": "<type-uuid>",
  "name": "APAC",
  "parent_uri": null,
  "meta": {}
}
```

For a child item, provide `parent_uri`:

```json
{
  "action": "create_item",
  "type_id": "<branch-type-uuid>",
  "name": "Singapore HQ",
  "parent_uri": "/<region-type-uuid>:<apac-item-uuid>",
  "meta": { "city": "Singapore", "country": "SG" }
}
```

| Field        | Type   | Required | Notes                                                |
| ------------ | ------ | -------- | ---------------------------------------------------- |
| `type_id`    | uuid   | ✓        | The scope type this item belongs to                  |
| `name`       | string | ✓        | Display name                                         |
| `parent_uri` | string |          | `uri_path` of the direct parent. Null for root items |
| `meta`       | object |          | Arbitrary metadata stored in `daas_scope_items.meta` |

The system computes `uri_path` = `parent_uri + "/" + type_id + ":" + new_item_id`.

#### `read_items`

```json
{
  "action": "read_items",
  "type_id": "<optional-type-uuid>"
}
```

Omit `type_id` to read all items. Returns `id`, `type_id`, `name`, `uri_path`, `parent_uri`, `meta`.

#### `update_item`

```json
{
  "action": "update_item",
  "id": "<item-uuid>",
  "name": "Singapore HQ (updated)",
  "meta": { "city": "Singapore", "hq": true }
}
```

> Cannot update `uri_path`, `type_id`, or `parent_uri` — these are immutable after creation.

#### `delete_item`

```json
{
  "action": "delete_item",
  "id": "<item-uuid>"
}
```

> Cascades to remove `daas_user_roles` and `daas_access` records with this `resource_uri`. Child items must be deleted first (leaf → root order).

---

### Collection Configs

#### `read_configs`

```json
{
  "action": "read_configs"
}
```

Returns all entries in `daas_scope_collection_config` — one row per collection that has scope enabled.

#### `update_config`

```json
{
  "action": "update_config",
  "collection": "orders",
  "scope_field": "branch_id",
  "inheritance_mode": "exact",
  "missing_uri_mode": "strict"
}
```

| Field              | Type   | Values                   | Description                                                                     |
| ------------------ | ------ | ------------------------ | ------------------------------------------------------------------------------- |
| `collection`       | string | any collection name      | Which collection this config applies to                                         |
| `scope_field`      | string | column name              | The column in this collection that stores the scope item UUID (FK to scope item)|
| `inheritance_mode` | string | `"exact"` \| `"down"`    | `exact` (default): only data with this exact URI; `down`: this URI + all descendants |
| `missing_uri_mode` | string | `"strict"` \| `"reject"` | `strict` (default): no scope = treat as root; `reject`: block if no scope header |

**Config decision guide:**

| Use case                                        | `inheritance_mode` | `missing_uri_mode` |
| ----------------------------------------------- | ------------------ | ------------------ |
| Strict: each branch owns its own data only      | `exact`            | `reject`           |
| Managers see data for all branches under them   | `down`             | `reject`           |
| Public collection, scope optional               | `down`             | `strict`           |
| Fully isolated tenants (no parent visibility)   | `exact`            | `reject`           |

---

### User-Role Assignments

#### `assign_user_role`

Grant a user a role effective only within a scope node (and descendants).

```json
{
  "action": "assign_user_role",
  "user_id": "<user-uuid>",
  "role_id": "<role-uuid>",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>/<branch-type-uuid>:<sgp-uuid>"
}
```

Writes to `daas_user_roles` with `resource_uri` set. The unique constraint is `(user_id, role_id, resource_uri)`.

#### `remove_user_role`

```json
{
  "action": "remove_user_role",
  "user_id": "<user-uuid>",
  "role_id": "<role-uuid>",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>/<branch-type-uuid>:<sgp-uuid>"
}
```

#### `read_user_roles`

```json
{
  "action": "read_user_roles",
  "user_id": "<user-uuid>"
}
```

Returns all scoped role assignments for the user, including `resource_uri` per row. Rows with `resource_uri: null` are global assignments.

---

## Scoped Access Entries

To restrict a policy to users operating in a specific scope, set `resource_uri` when creating a `daas_access` record via the `access` MCP tool:

```json
// mcp_daas_access -> action: create
{
  "role": "<role-uuid>",
  "policy": "<policy-uuid>",
  "resource_uri": "/<region-type-uuid>:<apac-uuid>"
}
```

This policy is only applied when the user's active scope URI starts with this `resource_uri` (i.e., they are at or below this scope node).

To filter existing access entries by scope:

```json
// mcp_daas_access -> action: read
{
  "filter_resource_uri": "/<region-type-uuid>:<apac-uuid>"
}
```

---

## Available Scopes API

**Endpoint:** `GET /api/scope/available`

Returns the scopes the current user can switch to, based on their `daas_user_roles.resource_uri` assignments. Also includes ancestor nodes for breadcrumb rendering (marked `selectable: false`).

**Response structure:**

```ts
interface ScopeItem {
  id: string;
  name: string;
  uri_path: string;
  type_id: string;
  type_name: string;
  parent_uri: string | null;
  selectable?: boolean; // false = ancestor-only (breadcrumb), true = can switch to
}
```

Rules:
- Items directly assigned to the user → `selectable: true`
- Descendants of assigned items → `selectable: true`
- Ancestors of assigned items (for breadcrumb display) → `selectable: false`

---

## ScopeSwitcher Component

Pre-built component that calls `/api/scope/available`, renders the scope tree, handles selection, and sets the `daas_resource_uri` cookie.

```tsx
import ScopeSwitcher from '@/components/ScopeSwitcher';

// Place in your header or navigation bar:
<ScopeSwitcher />
```

**Behavior:**
- Fetches available scopes on mount
- Shows items where `selectable !== false` in the selection list
- Full ancestor breadcrumb path is shown for selected item (including non-selectable ancestors)
- On selection: sets `daas_resource_uri` cookie (`path=/`, 30-day expiry) and refreshes the page

**Manual cookie control:**

```ts
// Select a scope
document.cookie = `daas_resource_uri=${encodeURIComponent(uri)}; path=/; max-age=${30 * 24 * 3600}`;

// Clear scope (return to global view)
document.cookie = `daas_resource_uri=; path=/; max-age=0`;
```

---

## Dynamic Variable Support in Scope Context

Policies can reference scope-aware dynamic variables when crafting permission filters. The standard `$CURRENT_USER` variables still apply:

| Variable                                        | Resolves To                                               |
| ----------------------------------------------- | --------------------------------------------------------- |
| `$CURRENT_USER.id`                              | Current user UUID                                         |
| `$CURRENT_USER.<junction>.<field>`              | Values from M2M junction for current user                 |

When a collection has `scope_field` configured, the scope UUID is extracted from the active `resource_uri` and applied as an additional data filter on top of the policy's own filter logic — you do NOT need to add a manual `scope_field` filter in your policy.
