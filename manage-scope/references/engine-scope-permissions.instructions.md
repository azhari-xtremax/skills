---
name: Scope Permissions (Engine project)
description: How the Engine checks the scope of each request on an Engine project — downward role assignments, scoped access entries, the collection scope filter, inheritance_mode and missing_uri_mode, the scope error codes, and administrators.
applyTo: "**/*.{ts,tsx}"
---

<!-- buildpad-backend-file: engine -->
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

# Scope Permissions Instructions (Engine project)

The Engine's permission enforcement is fully scope-aware. When a request carries a scope URI in the `X-Resource-Uri` header, every permission check and data filter operates in that scope. Send the scope in that header: a cookie on the app's origin never reaches the Engine.

---

## Permission Inheritance: How It Works

Role assignments reach **downward (an ancestor's assignment covers its descendants)**:

```
Scope Tree:
  /<T>:<p>                                  ← the project's tenant node
    /<T>:<p>/<region>:<apac>                ← Role assigned HERE
      /<T>:<p>/<region>:<apac>/<branch>:<sgp>  ← Role IS EFFECTIVE here (descendant)
      /<T>:<p>/<region>:<apac>/<branch>:<lon>  ← Role IS EFFECTIVE here (descendant)

    /<T>:<p>/<region>:<emea>                ← Role NOT effective here (different subtree)
```

**Inheritance resolution table** (every path below starts with the tenant segment `/<T>:<p>`, left out here):

| Role assigned at URI      | Request at URI                   | Access granted? |
| ------------------------- | -------------------------------- | --------------- |
| `/<r>:<apac>`             | `/<r>:<apac>`                    | ✓ (exact match) |
| `/<r>:<apac>`             | `/<r>:<apac>/<b>:<sgp>`          | ✓ (descendant)  |
| `/<r>:<apac>`             | `/<r>:<apac>/<b>:<sgp>/<f>:<f1>` | ✓ (descendant)  |
| `/<r>:<apac>/<b>:<sgp>`   | `/<r>:<apac>`                    | ✗ (ancestor)    |
| `/<r>:<apac>`             | `/<r>:<emea>`                    | ✗ (different subtree) |
| the tenant node `/<T>:<p>` | any URI in the project          | ✓ (always)      |

**Algorithm:** A role at URI `A` is effective at request URI `R` when:
```
R === A  OR  R.startsWith(A + '/')
```

---

## How the Engine Checks a Request

Every request to a collection goes through the same steps, in order:

1. **The scope is read** from `X-Resource-Uri`.
   - A URI that names no scope node → `400 INVALID_SCOPE`.
   - A URI that none of the user's role assignments covers → `403 FORBIDDEN_SCOPE`.
   - No header, on a collection that has a scope setting → served only to a user who reaches every scope; anyone else gets `403 MISSING_SCOPE`. With `missing_uri_mode: "reject"` everyone gets `403 MISSING_SCOPE`, administrators included.
2. **The user's policies at that scope are collected**: the roles assigned to the user at the active scope or above it, and, for each of those roles, the access entries whose `resource_uri` is empty or at the active scope or above it; plus the policies granted to the user directly, and those granted to every signed-in user. A user must hold both ends of a role's grant at the scope: the assignment and the access entry.
3. **The action is checked**: the request is allowed when any of those policies has a permission for the collection and action, or a policy has `admin_access: true`. Otherwise `403 FORBIDDEN`.
4. **The rows are confined**: the permission filters of those policies, OR-merged, and the collection's scope filter (below), AND-ed together.

Without a scope, the request is answered at the root: only the assignments and access entries with no `resource_uri` count.

---

## Data Filter: The Collection's Scope Setting

Beyond the permission filter, a collection registered in `/api/scope/collection-config` is confined by its scope field:

| `inheritance_mode` | Rows returned                                                         |
| ------------------ | --------------------------------------------------------------------- |
| `"exact"`          | rows whose scope field equals the active `uri_path`                   |
| `"down"` (default) | rows whose scope field is the active `uri_path` or a node below it    |

On create, the Engine writes the active scope into the scope field. A value the request sends for the scope field must name an existing node.

**`missing_uri_mode` behavior:**

| `missing_uri_mode` | No scope URI in request | Effect                                                         |
| ------------------ | ----------------------- | -------------------------------------------------------------- |
| `"strict"` (default) | → depends on the user | Served, unconfined, only to a user who reaches every scope; anyone else gets 403 `MISSING_SCOPE` |
| `"reject"`         | → request blocked       | 403 `MISSING_SCOPE` for everyone; no data returned             |

---

## Scoped Access Entry Resolution

Access entries can have `resource_uri` set, which scopes the policy assignment:

```
Request at: /<T>:<p>/<r>:<apac>/<b>:<sgp>

Access entry 1: role=manager, policy=orders-read, resource_uri=/<T>:<p>/<r>:<apac>
  → ancestor of the request URI  → MATCH ✓

Access entry 2: role=manager, policy=orders-write, resource_uri=/<T>:<p>/<r>:<emea>
  → NOT an ancestor of the request URI  → SKIP ✗

Access entry 3: role=manager, policy=global-read, resource_uri=null
  → null always matches  → MATCH ✓
```

This means the same role can have **different effective policies depending on the scope**. A manager role in APAC gets different write permissions than in EMEA. Each entry still counts only when the manager role itself is assigned to the user at or above the request URI.

---

## Permission Filter: `$CURRENT_USER` Dynamic Variables

Dynamic variables in policy permission filters work identically in scoped and global contexts. The scope system adds an independent layer on top of policy filters — it does NOT replace them.

**Effective filter = scope data filter AND policy permission filter**

Example policy filter (in addition to scope):
```json
{
  "owner_id": { "_eq": "$CURRENT_USER" }
}
```

Variables the Engine resolves:

| Variable                | Resolves To                                   |
| ----------------------- | --------------------------------------------- |
| `$CURRENT_USER`         | The authenticated user's UUID                 |
| `$CURRENT_USER.<field>` | One column of the user's own record           |
| `$CURRENT_ROLE`         | One role UUID of the user                     |
| `$NOW`                  | The current time                              |

A path through a relation or a junction (`$CURRENT_USER.<junction>.<field>`), `$CURRENT_ROLES` and `$CURRENT_POLICIES` are refused on an Engine project.

---

## Administrators

A user whose policy has `admin_access: true`, granted with no `resource_uri`, passes every permission check, and `GET /api/scope/available` answers them `root_access: true`. A collection registered with `missing_uri_mode: "reject"` still needs `X-Resource-Uri`, from an administrator too.
