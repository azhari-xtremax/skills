---
name: Hooks and Runtime Extensions (Engine project)
description: Event hooks and runtime extensions of an Engine project — filter and action hooks stored in the Engine, their events, context and services, and how to manage and check them through the REST API.
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

# Hooks and Runtime Extensions (Engine project)

This guide covers the event hooks and runtime extensions of an Engine project: JavaScript stored in the Engine and run on item events. Manage them in the Studio's Extensions module, through the Engine's REST API with an administrator's access token, or through the Engine's MCP tool `extensions`, which is listed and served to an administrator only. The Engine loads no extension from files.

On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the Engine runtime table in the [hooks-extensions skill](../SKILL.md) lists; for each interface it lacks, the table says what replaces it.

## Overview

The Engine provides an event-driven architecture for custom business logic:

- **Event Hooks**: React to item operations (create, update, delete, read, query)
- **Runtime Extensions**: Hooks stored in `daas_extensions`, managed through `/api/extensions` (live in every process of the Engine as soon as a change is saved)

---

## Event System

### Event Types

| Type       | Timing                                   | Purpose               | Can Modify Data |
| ---------- | ---------------------------------------- | --------------------- | --------------- |
| **Filter** | Inside the request, before the operation | Validate, transform   | ✅ Yes          |
| **Action** | After the commit, in its own run         | Side effects, logging | ❌ No           |

A filter that throws refuses the operation, and the caller gets the status the hook chose. An action that throws is logged; the response is already decided and is unaffected.

### Event Names

Events follow the pattern `[collection].items.[operation]` or `items.[operation]`. Every item emission fires the generic name and then the collection's own name.

| Event                   | Trigger                | Filter `payload`  | `meta`                                   |
| ----------------------- | ---------------------- | ----------------- | ---------------------------------------- |
| `items.query`           | Before a query runs    | The parsed query  | `collection`                             |
| `items.read`            | Item(s) read           | The rows fetched  | `collection`, `query`; `keys` on the action |
| `items.create`          | Item created           | The write payload | `collection`; `key` and `payload` on the action |
| `items.update`          | Item(s) updated        | The write payload | `collection`, `keys`; `payload` on the action |
| `items.delete`          | Item(s) deleted        | The key list      | `collection`, `keys`                     |
| `articles.items.create` (and the other operations) | The same, for one collection | As above | As above |
| `versions.create`       | Version created        | —                 | `collection`, `key`, `keys`, `payload` (action only) |

`meta.event` holds the name that matched. One `event` may name several events separated by commas, for example `articles.items.create,articles.items.update`. A batch operation emits once with every key in `meta.keys`, except the create filter, which runs once per row.

A workflow command's `actions` name an `event_name` the Engine emits after the transition commits. An action hook whose `event` is that name receives it: `meta.collection` and `meta.key` name the item, and `meta.payload` is a one-element array holding the command's parameters and a `workflow_instance` object (`id`, `workflow`, `workflow_name`, `collection`, `item_id`, `version_key`, `current_state`, `previous_state`, `terminated`), so read it as `const [entry] = meta.payload;`. See the [create-workflow skill](../../create-workflow/SKILL.md).

#### What emits events

Events come from item operations through the Items API, the MCP `items` tool, and `services.items` in stored code. The Engine's administration routes — users, roles, policies, permissions, cron jobs, custom services, extensions, settings, scope, folders and files — emit no event, and there are no sign-in or sign-out events. Do not write a hook that waits for one.

### Filter Hooks (Blocking)

Filter hooks run **before** an operation, inside the request, and can modify the payload. The operation waits for every filter.

**Use cases:**

- Validation (throw to abort)
- Data transformation
- Auto-populate fields
- Sanitization

**A filter's code sees** `payload`, `meta`, `context`, `services`, `console`, `JSON`, `Date`, `Math` and `HookError`. Its return value replaces the payload for the next filter and for the write; returning nothing keeps the payload as it stands. A filter runs before the caller's grant is applied to the payload, so it cannot write a column the caller may not.

**Example: Validate and transform**

```javascript
// Filter code for articles.items.create
if (!payload.title || payload.title.trim().length < 3) {
  throw new HookError("Title must be at least 3 characters", 422, "VALIDATION_FAILED");
}

return {
  ...payload,
  title: payload.title.trim(),
  slug: payload.title.toLowerCase().replace(/\s+/g, "-"),
  word_count: payload.content?.split(/\s+/).length || 0,
};
```

### Action Hooks (Non-blocking)

Action hooks run **after** the operation has committed, in a run of their own, and don't block the response.

**Use cases:**

- Logging and audit trails
- Notifications
- External API calls (through `services.fetch`)
- Analytics

**An action's code sees** `meta`, `context`, `services`, `console`, `JSON`, `Date` and `Math`. Its return value is ignored.

**Example: Log creation**

```javascript
// Action code for items.create
console.log(`[Audit] Item created in ${meta.collection}`);
console.log(`  Key: ${meta.key}`);
console.log(`  User: ${context.accountability?.user}`);
console.log(`  Time: ${new Date().toISOString()}`);
```

---

## Runtime Extensions

Runtime extensions are hooks stored in the Engine that can be created, checked, and changed without redeploying the application.

### Benefits

- ✅ **Live at once**: A saved change reaches every process of the Engine before the request answers
- ✅ **Manageable**: Through the Studio's Extensions module or `/api/extensions`
- ✅ **Safe to stage**: A new extension is stored `inactive` until you activate it
- ✅ **Auditable**: `created_by`, `updated_by` and the activity log record who changed it

### Extension Schema

| Field             | Type                   | Description                         |
| ----------------- | ---------------------- | ----------------------------------- |
| `id`              | UUID                   | Primary key                         |
| `name`            | string                 | Human-readable name (required)      |
| `description`     | string                 | What the extension does             |
| `event`           | string                 | Event(s) to listen for, comma-separated (required) |
| `type`            | 'filter' \| 'action'   | Hook type (required)                |
| `code`            | string                 | JavaScript code; must compile (required) |
| `status`          | 'active' \| 'inactive' | Enable/disable; `inactive` when omitted |
| `sort`            | number                 | Execution order (default 0)         |
| `timeout_ms`      | number                 | Max run time (default 5000)         |
| `memory_limit_mb` | number                 | Stored and shown; not enforced      |

### Available Context in Extensions

```javascript
// payload - The data being written, the rows read, or the parsed query (filter only)
// meta - Operation metadata
{
  event: 'articles.items.create',
  collection: 'articles',
  key: 'uuid-of-created-item',       // create action only
  keys: ['uuid1', 'uuid2'],          // update, delete (and the read action)
  payload: { title: 'New Article' }  // create and update actions
}

// context - Execution context
{
  accountability: {
    user: 'user-uuid',               // the caller who fired the hook
    role: 'role-uuid',
    roles: ['role-uuid'],            // every role the caller holds
    admin: false,
    app: true
  },
  resourceUri: 'tenant-scope-uri',   // the caller's tenant scope
  services: { /* the same object as services */ }
}
```

A hook runs as the caller who fired it (the system account when there is none), in that caller's tenant. `services.items` inside it is checked against the caller's grants; `{ elevated: true }` checks as an administrator while the audit trail still names the caller.

### Services Available in Extensions

In extensions, `services` is a **direct variable** (and also `context.services`):

```javascript
// Items - CRUD on any collection
const items = services.items("articles");
const someArticles = await items.readByQuery({ limit: 10 });
const newId = await items.createOne({ title: "New" });
await items.updateOne(newId, { status: "published" });

// Versions - read and promote (versions are created through /api/versions)
const versions = services.versions();
const drafts = await versions.readAll({ collection: "articles", item: "article-uuid" });

// Mail - returns { success, ... } and does not throw when mail cannot be sent
const sent = await services.mail({
  to: 'admin@company.com',
  subject: 'New item created',
  text: `Item ${meta.key} created in ${meta.collection}`
});
if (!sent.success) console.warn('Mail not sent:', sent.error);

// Custom service - Reusable shared code
const helpers = await services.custom('date_helpers');
const formatted = helpers.formatDate(new Date());

// HTTP requests (only hosts the Engine's operator allows)
const response = await services.fetch(
  "https://api.example.com/webhook",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: meta.event }),
  },
);
```

There is no Supabase service and no SQL from a hook on an Engine project: read and write through `services.items`.

> See the [Engine services API](engine-services-api.instructions.md) for every method signature.

---

## Managing Extensions through the REST API

Send each request with an administrator's access token (`Authorization: Bearer <access token>`), from a server-side script or route; never with the token in the project's MCP configuration. A user whose role holds `read` on `daas_extensions` may list and read extensions; every other route is administrator-only.

### List Extensions

```bash
curl "$ENGINE_URL/api/extensions?status=active&event=articles.items.create" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

The list is ordered by `event`, then `sort`. It also takes `type`, `search`, `page` and `limit`.

### Create Extension

```bash
curl -X POST "$ENGINE_URL/api/extensions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Auto-slug generator",
    "description": "Generates URL slug from title for articles",
    "event": "articles.items.create",
    "type": "filter",
    "code": "if (!payload.slug && payload.title) { payload.slug = payload.title.toLowerCase().replace(/[^a-z0-9]+/g, \"-\").replace(/(^-|-$)/g, \"\"); } return payload;",
    "status": "inactive"
  }'
```

The answer is `201` with the stored extension under `data`. A missing name, event, type or code, a type other than `filter` or `action`, code that does not compile, or a non-positive limit is refused with `400` and nothing is stored.

### Check an Extension (there is no test route)

The Engine has no route that runs a hook on a test payload. Check a hook on real writes:

1. Create it with `"status": "inactive"` (above).
2. Activate it: `POST /api/extensions/:id/activate`.
3. Write a scratch item to the collection it handles, through the Items API or the Studio, and read the answer: a filter's change is in the stored item, and a refusal is the hook's status and message.
4. Read the hook's console lines in the Engine's log: `GET /api/logs` (an administrator or a holder of `system:logs`).
5. Delete the scratch item. If the hook is wrong, deactivate it at once (`POST /api/extensions/:id/deactivate`), fix it with `PATCH`, and repeat.

```bash
curl -X POST "$ENGINE_URL/api/extensions/<extension-id>/activate" -H "Authorization: Bearer $ACCESS_TOKEN"

curl -X POST "$ENGINE_URL/api/items/articles" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Hello World Article", "content": "Scratch item for the hook check" }'
# → data.slug is "hello-world-article"
```

### Update, Deactivate, Clone and Delete

```bash
# Update the fields sent
curl -X PATCH "$ENGINE_URL/api/extensions/<extension-id>" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{ "code": "return payload;", "sort": 2 }'

# Deactivate
curl -X POST "$ENGINE_URL/api/extensions/<extension-id>/deactivate" -H "Authorization: Bearer $ACCESS_TOKEN"

# Clone (the copy is named "<name> (copy)" unless you send a name)
curl -X POST "$ENGINE_URL/api/extensions/<extension-id>/clone" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d '{ "name": "Auto-slug v2" }'

# Delete
curl -X DELETE "$ENGINE_URL/api/extensions/<extension-id>" -H "Authorization: Bearer $ACCESS_TOKEN"
```

The Engine's operator can stop every hook at once with `RUNTIME_EXTENSIONS_ENABLED=false`: the remedy when a broken filter refuses every write.

---

## Common Extension Patterns

### 1. Auto-Populate Fields

```javascript
// Filter: articles.items.create
// Auto-set reading_time based on content length

const wordCount = (payload.content || "").split(/\s+/).filter(Boolean).length;
payload.reading_time = Math.ceil(wordCount / 200); // 200 words per minute
payload.word_count = wordCount;

return payload;
```

### 2. Validation

```javascript
// Filter: products.items.create
// Validate required fields and price

if (!payload.name || payload.name.trim().length === 0) {
  throw new HookError("Product name is required", 422, "VALIDATION_FAILED");
}

if (payload.price !== undefined && payload.price < 0) {
  throw new HookError("Price cannot be negative", 422, "VALIDATION_FAILED");
}

if (payload.sku && !/^[A-Z0-9-]+$/.test(payload.sku)) {
  throw new HookError(
    "SKU must contain only uppercase letters, numbers, and hyphens",
    422,
    "VALIDATION_FAILED",
  );
}

return payload;
```

### 3. Audit Logging

```javascript
// Action: items.update
// Log all updates to an audit collection (one row per updated key)

const items = context.services.items("audit_logs");

for (const key of meta.keys) {
  await items.createOne({
    action: "update",
    collection: meta.collection,
    item_id: key,
    user_id: context.accountability?.user,
    changes: JSON.stringify(meta.payload),
    timestamp: new Date().toISOString(),
  });
}
```

Bind this hook to `items.update` only for collections other than `audit_logs`, or check `meta.collection`, so that its own write does not fire it again. The Engine stops a chain of hook-fired writes eight levels deep.

### 4. Send Notification on Status Change

```javascript
// Action: articles.items.update
// Send webhook when article is published (hooks.slack.com must be an allowed host)

if (meta.payload.status === "published") {
  await context.services.fetch("https://hooks.slack.com/services/xxx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `Article published: ${meta.payload.title || meta.keys.join(", ")}`,
    }),
  });
}
```

### 5. Cascade Updates

```javascript
// Action: categories.items.update
// Update all products when category name changes

if (meta.payload.name) {
  const products = context.services.items("products");

  // Get the products in the updated categories (readByQuery returns the array itself)
  const affected = await products.readByQuery({
    filter: { category_id: { _in: meta.keys } },
    fields: ["id"],
    limit: 1000,
  });

  // Update each product's cached category name in one call
  if (affected.length > 0) {
    await products.updateMany(affected.map((p) => p.id), {
      category_name_cache: meta.payload.name,
    });
  }
}
```

### 6. Prevent Deletion of Referenced Items

```javascript
// Filter: categories.items.delete
// Prevent deleting categories with products (payload is the key list)

const products = context.services.items("products");
const found = await products.readByQuery({
  filter: { category_id: { _in: meta.keys } },
  limit: 1,
});

if (found.length > 0) {
  throw new HookError("Cannot delete category with existing products", 409, "CATEGORY_IN_USE");
}

return payload;
```

---

## Extension Execution Order

When several extensions match an event:

1. Extensions run in `sort` order (ascending), then by id
2. Filter hooks run **one after another** (each receives the output of the previous)
3. Action hooks each run in a run of their own after the commit; do not rely on their order

```javascript
// Extension 1 (sort: 1): Trim whitespace
payload.title = payload.title?.trim();
return payload;

// Extension 2 (sort: 2): Generate slug (receives trimmed title)
payload.slug = payload.title?.toLowerCase().replace(/\s+/g, "-");
return payload;

// Extension 3 (sort: 3): Validate (receives slug)
if (!payload.slug) throw new HookError("Slug required");
return payload;
```

---

## Error Handling

### Filter Hook Errors

Throwing in a filter hook **aborts the operation**:

```javascript
// This will prevent the item from being created
if (payload.status === "published" && !payload.approved_by) {
  throw new HookError("Articles must be approved before publishing", 422, "APPROVAL_REQUIRED");
}
```

The error is returned to the client with the hook's status and code:

```json
{
  "errors": [
    {
      "message": "Extension 'Require approval' validation failed: Articles must be approved before publishing",
      "extensions": { "code": "APPROVAL_REQUIRED" }
    }
  ]
}
```

A plain `Error` answers `400` with the code `HOOK_VALIDATION_FAILED`. A filter that runs longer than its `timeout_ms` answers `500`.

### Action Hook Errors

Action hooks run after the operation has committed. Errors are logged but don't affect the response:

```javascript
// This won't fail the original operation
try {
  await context.services.fetch("https://unreliable-api.com/webhook");
} catch (error) {
  console.error("Webhook failed:", error.message);
  // Original operation already succeeded
}
```

A failed service call arrives as an `Error` carrying `statusCode` and `code` (for example `403 FORBIDDEN` for a host that is not allowed, `502 RUNTIME_FETCH_FAILED` for an upstream failure).

---

## Best Practices

1. **Return the payload in filter hooks** - Even if unchanged
2. **Keep hooks focused** - One hook, one responsibility
3. **Check before relying on a hook** - Create it inactive, activate it, write a scratch item, read the log
4. **Handle errors gracefully** - Especially in action hooks
5. **Use descriptive names** - The name is in every refusal message
6. **Set appropriate sort order** - For dependent hooks
7. **Log important operations** - Console lines reach `GET /api/logs`

---

## Related Instructions

- See the [daas-platform skill](../../daas-platform/SKILL.md) for the Engine's API
- See the [Engine services API](engine-services-api.instructions.md) for every service method
- See the [create-workflow skill](../../create-workflow/SKILL.md) for workflow actions
