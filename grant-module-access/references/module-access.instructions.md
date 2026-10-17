---
name: Module-Level Access
description: Reference for the DaaS built-in Module-Level Access Keys feature — application capability flags that integrate natively with the DaaS Policy/Role/User chain.
applyTo: "**/*.{ts,tsx}"
---

# Module-Level Access — Implementation Reference

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

Platform-native capability flags stored as `module_access JSONB` on `daas_policies` and managed via the `daas_module_access_keys` registry. No custom columns or server utilities required.

## Architecture Overview

```
daas_module_access_keys (registry)
  └─ { id, parent_id, display_name, key: "reports:export" }

daas_policies.module_access (JSONB)
  └─ { "reports:export": true, "workflow:approve": false }

User
 ├── daas_access (direct user → policy)
 └── daas_user_roles → Role → daas_access → Policy
                                           ↓
         OR-merge module_access across all policies → effectiveModuleAccess
```

Admin users (`admin_access: true` on any policy) receive `true` for all keys.

---

## Key Registry (`daas_module_access_keys`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `parent_id` | UUID nullable | Self-reference — null = root node |
| `display_name` | text | Label shown in Policy editor |
| `description` | text nullable | Optional explanation |
| `key` | varchar(100) nullable | `null` = folder node; non-null = leaf (grantable) |
| `sort` | int | Display order within siblings |

Key format constraint: `^[a-z][a-z0-9_:./-]*$`, globally UNIQUE.

<!-- buildpad-backend: supabase -->
### System-seeded keys

| Key | Purpose |
|---|---|
| `system:logs` | View application logs page |
| `system:activity` | View activity feed |
| `system:cron` | Manage cron jobs |
| `system:settings.smtp` | Configure SMTP settings |
| `system:settings.cors` | Configure CORS settings |
| `system:settings.ai` | Configure AI settings |
| `system:settings.general` | Configure general settings |
| `system:extensions` | Manage extensions |
| `system:services` | Manage custom services |
| `workflow:approve` | Execute `approve` workflow transitions |
| `workflow:reject` | Execute `reject` workflow transitions |
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
### System-seeded keys

| Key | Purpose |
|---|---|
| `system:logs` | View application logs page |
| `workflow:approve` | Execute `approve` workflow transitions |
| `workflow:reject` | Execute `reject` workflow transitions |

On an Engine project these three are seeded; register any other key you need.
<!-- /buildpad-backend -->

---

<!-- buildpad-backend: supabase -->
## MCP Tools

### Register a key

```json
{
  "name": "module_access_keys",
  "arguments": {
    "action": "create",
    "data": {
      "display_name": "Export Reports",
      "key": "reports:export",
      "sort": 10
    }
  }
}
```

### Grant on a policy

```json
{
  "name": "policies",
  "arguments": {
    "action": "update",
    "id": "<policy-uuid>",
    "data": {
      "module_access": { "reports:export": true }
    }
  }
}
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## MCP Tools

### Register a key

On an Engine project keys are rows of `daas_module_access_keys`, written with the `items` tool:

```json
{
  "name": "items",
  "arguments": {
    "action": "create",
    "collection": "daas_module_access_keys",
    "data": {
      "display_name": "Export Reports",
      "key": "reports:export",
      "sort": 10
    }
  }
}
```

### Grant on a policy

```json
{
  "name": "policies",
  "arguments": {
    "action": "update",
    "id": "<policy-uuid>",
    "data": {
      "module_access": { "reports:export": true }
    }
  }
}
```
<!-- /buildpad-backend -->

---

## Client Hook

`hasModuleAccess` is part of `PermissionsContext` — available everywhere the context is mounted:

```typescript
import { usePermissions } from '@/lib/buildpad/hooks';

const { hasModuleAccess, moduleAccess } = usePermissions();

// Single key
const canExport = hasModuleAccess('reports:export');

// All resolved flags
console.log(moduleAccess); // → { "reports:export": true, ... }
```

`hasModuleAccess` returns `true` for admin users unconditionally.

---

## API Response

`GET /api/permissions/me` now includes:

```json
{
  "data": { /* collection permissions */ },
  "isAdmin": false,
  "moduleAccess": {
    "reports:export": true,
    "workflow:approve": false
  }
}
```

---

<!-- buildpad-backend: supabase -->
## Server-Side Check Pattern

```typescript
const { data: policyIds } = await supabase.rpc('get_user_policies', { user_id: user.id });
const { data: policies } = await supabase
  .from('daas_policies')
  .select('module_access, admin_access')
  .in('id', policyIds ?? []);

const isAdmin = policies?.some(p => p.admin_access);
const allowed = isAdmin || policies?.some(
  p => (p.module_access as Record<string, boolean>)?.['reports:export'] === true
);

if (!allowed) return new Response('Forbidden', { status: 403 });
```
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Server-Side Check Pattern

On an Engine project some files the Buildpad CLI generates cannot be used yet: `lib/supabase/admin.ts`, the OAuth callback and provider routes, the server-side enforcer and session modules, and `lib/module-access/enforce.ts`. Do not call them; check module access by forwarding the user's token to `GET <Engine_URL>/api/permissions/me` and reading `isAdmin` and `moduleAccess`.

```typescript
const headers = await getAuthHeaders(); // from '@/lib/api/auth-headers'
const res = await fetch(`${getDaasUrl()}/api/permissions/me`, { headers, cache: 'no-store' });
const { isAdmin, moduleAccess } = await res.json();

const allowed = isAdmin === true || moduleAccess?.['reports:export'] === true;

if (!allowed) return new Response('Forbidden', { status: 403 });
```
<!-- /buildpad-backend -->

---

## Workflow Integration

```json
{
  "name": "approve",
  "next_state": "approved",
  "module_access_keys": ["workflow:approve"],
  "policies": [],
  "actions": []
}
```

`module_access_keys` and `policies` are OR'd in the transition route. Existing `policies`-only workflows are fully backward compatible.


<!-- buildpad-backend: supabase -->
Full implementation guide for adding named boolean permission flags (`"MyApp.Feature.Key": true`) that integrate with the DaaS Policy/Role/User assignment chain.

## Architecture Overview

```
daas_policies.custom_permissions (JSONB)
  └─ { "MyApp.Dashboard.TaskWidget": true, "MyApp.Reports.Export": false }

User
 ├── daas_access (direct user → policy)
 └── daas_user_roles → Role → daas_access → Policy
                                           ↓
            merge all policies with OR → effectiveCustomPermissions
```

One policy assignment grants both data-access rules (existing `daas_permissions` rows) and custom capability flags (`custom_permissions` JSONB).

---

## Database: Add Column via MCP

```json
// MCP tool call — no SQL migration file needed
{
  "name": "fields",
  "arguments": {
    "action": "create",
    "data": {
      "collection": "daas_policies",
      "field": "custom_permissions",
      "type": "json",
      "meta": {
        "required": false,
        "hidden": false,
        "note": "Application capability flags: { \"AppName.Domain.Key\": boolean }"
      }
    }
  }
}
```

`PATCH /api/policies/:id` immediately accepts and round-trips `custom_permissions` because DaaS uses `select('*')`.

---

## Server-Side Utilities (`lib/permissions/custom.ts`)

```typescript
// Installed via: npx buildpad add lib/permissions/custom
import { getCustomPermissions, hasCustomPermission, enforceCustomPermission } from '@/lib/permissions/custom';

// In a Server Component
const perms = await getCustomPermissions();
// → { "MyApp.Dashboard.TaskWidget": true, "MyApp.Reports.Export": false }

// In an API route handler
await enforceCustomPermission('MyApp.LeaveRequest.Reject'); // throws PermissionError(403) if denied
```

### Full API

| Export | Where to use | Behaviour |
|--------|-------------|-----------|
| `getCustomPermissions()` | Server Component, API route | Returns merged `Record<string, boolean>` for current user |
| `hasCustomPermission(key)` | Server Component, API route | Returns `boolean` for one key |
| `enforceCustomPermission(key)` | API route handler | Throws 403 `PermissionError` if key is not `true` |

Admin users (any policy with `admin_access: true`) always receive `true` for all keys.

---

## Extend `/api/permissions/me`

```typescript
// Append to the existing /api/permissions/me GET handler
import { resolveCustomPermissions } from '@/lib/permissions/custom';

// After building allPermissions...
const custom = isAdmin ? {} : await resolveCustomPermissions(supabase, policyIdArray);

return NextResponse.json({
  data: allPermissions,
  custom,          // ← new field piggybacks on existing request
  isAdmin,
});
```

Or add a standalone endpoint:

```
GET /api/permissions/me/custom
→ { "data": { "MyApp.Dashboard.TaskWidget": true, ... } }
```

---

## Built-in: `GET /api/policies/me` (Scope-aware)

The platform provides `GET /api/policies/me` which returns the **full policy rows** for the current user at a given scope, including any custom JSONB fields:

```
GET /api/policies/me
Header: X-Resource-URI: /tenant:123/dept:456   (optional — omit for root scope)
```

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Tenant Admin",
      "admin_access": false,
      "custom_permissions": { "MyApp.Dashboard.TaskWidget": true },
      "feature_flags": { "beta_ui": true }
    }
  ],
  "meta": {
    "resource_uri": "/tenant:123/dept:456",
    "is_admin": false
  }
}
```

Uses `get_user_policies_for_scope(userId, resourceUri)` with upward ancestor matching. Admin users receive all policies.

The client owns merging logic — example with boolean OR:

```typescript
// Merge custom_permissions across all policies (true wins)
const flags = policies.data.reduce((acc, policy) => ({
  ...acc,
  ...(policy.custom_permissions ?? {}),
}), {} as Record<string, boolean>);

const canReject = flags['MyApp.LeaveRequest.Reject'] === true;
```

This is the **recommended approach** when the application adds custom JSONB columns to `daas_policies` and needs to read them client-side at a specific scope.

---

## Client-Side Context Extension

```typescript
// lib/contexts/PermissionsContext.tsx — add to PermissionsContextValue
interface PermissionsContextValue {
  // ... existing fields ...
  customPermissions: Record<string, boolean>;
  hasCustomPermission: (key: string) => boolean;
}

// In PermissionsProvider.fetchPermissions()
const data = await response.json();
setPermissions(data.data || {});
setCustomPermissions(data.custom || {});   // ← no extra network call

// Resolver
const hasCustomPermission = useCallback(
  (key: string): boolean => {
    if (isAdmin) return true;
    return customPermissions[key] === true;
  },
  [customPermissions, isAdmin]
);
```

---

## Client Hooks

```typescript
/**
 * Check a single custom permission flag.
 * Returns false when key is absent or explicitly false.
 *
 * @example
 * const canReject = useCustomPermission('MyApp.LeaveRequest.Reject');
 * return canReject ? <Button>Reject</Button> : null;
 */
export function useCustomPermission(key: string): boolean {
  const { hasCustomPermission } = usePermissions();
  return useMemo(() => hasCustomPermission(key), [key, hasCustomPermission]);
}

/**
 * Returns the full resolved custom permissions map.
 * Useful for rendering dynamic capability lists.
 */
export function useCustomPermissions(): Record<string, boolean> {
  const { customPermissions } = usePermissions();
  return customPermissions;
}
```

---

## API Route Pattern

```typescript
// app/api/leave-requests/[id]/reject/route.ts
import { enforceCustomPermission } from '@/lib/permissions/custom';
import { enforcePermission } from '@/lib/permissions/enforcer';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Custom flag guard (application capability)
  await enforceCustomPermission('MyApp.LeaveRequest.Reject');

  // 2. Data-access guard (collection permission) — unchanged
  await enforcePermission({ collection: 'leave_requests', action: 'update' });

  // 3. Business logic
  const { id } = await params;
  // ...
}
```

Both `enforceCustomPermission` and `enforcePermission` throw `PermissionError` which the standard error handler serialises as `{ error: '...' }` with status 403.

---

## Component Patterns

### Guard a widget

```tsx
function Dashboard() {
  const showTaskWidget = useCustomPermission('MyApp.Dashboard.TaskWidget');
  const showAnalytics  = useCustomPermission('MyApp.Dashboard.Analytics');

  return (
    <SimpleGrid cols={2}>
      {showTaskWidget && <TaskWidget />}
      {showAnalytics  && <AnalyticsWidget />}
      <CalendarWidget /> {/* always visible */}
    </SimpleGrid>
  );
}
```

### Guard action buttons

```tsx
function LeaveRequestActions({ id }: { id: string }) {
  const canApprove = useCustomPermission('MyApp.LeaveRequest.Approve');
  const canReject  = useCustomPermission('MyApp.LeaveRequest.Reject');

  return (
    <Group>
      {canApprove && <Button color="green" onClick={() => approve(id)}>Approve</Button>}
      {canReject  && <Button color="red"   onClick={() => reject(id)}>Reject</Button>}
    </Group>
  );
}
```

### Guard a page (Server Component)

```typescript
// app/reports/export/page.tsx
import { hasCustomPermission } from '@/lib/permissions/custom';
import { redirect } from 'next/navigation';

export default async function ExportPage() {
  if (!(await hasCustomPermission('MyApp.Reports.Export'))) redirect('/403');
  // ...
}
```

---

## Policy Editor UI (`components/CustomPermissionsEditor.tsx`)

```bash
npx buildpad add components/CustomPermissionsEditor
```

```tsx
// Usage in Policy detail page
import { CustomPermissionsEditor } from '@/components/CustomPermissionsEditor';

{!isNew && policy && (
  <Paper shadow="xs" p="md" withBorder mt="md">
    <CustomPermissionsEditor
      policyId={policy.id}
      onChange={(updated) => console.log('custom_permissions saved', updated)}
    />
  </Paper>
)}
```

The editor validates key naming (`AppName.Domain.Capability` dot-notation), prevents duplicates, and persists via `PATCH /api/policies/:id`.

---

## Key Naming Rules

| Rule | Example |
|------|---------|
| Must start with app name | `MyApp.` |
| Three segments minimum | `MyApp.Domain.Capability` |
| PascalCase segments | `MyApp.LeaveRequest.Reject` |
| Reserved: `DaaS.*` | Never use this prefix |
| Multi-tenant: prefix with scope | `TenantA.MyApp.Reports.Export` |

---

## Security

- FE `useCustomPermission` checks are **UX only** (hide/show controls)
- `enforceCustomPermission` in the API route is the **security boundary**
- Only `admin_access: true` users can write `daas_policies` — no privilege escalation
- Admin bypass is consistent with collection permission behaviour
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
## Custom Capability Flags on Policies

Custom policy columns are not available on an Engine project: a policy holds a fixed set of fields, and an extra column on the policies collection is not one of them. If the developer asks for custom capability columns on policies, tell them so and stop. Application capability flags on an Engine project are the module access keys described above.
<!-- /buildpad-backend -->
