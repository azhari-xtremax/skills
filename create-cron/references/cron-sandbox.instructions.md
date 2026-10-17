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

<!-- buildpad-backend: supabase -->
````instructions
---
name: Cron Sandbox Environment
description: JavaScript sandbox for cron job code — context variables, services, blocked globals, and coding patterns
applyTo: "**/*.{ts,tsx,json}"
---

# Cron Sandbox Environment

Cron jobs execute in the same sandboxed JavaScript environment as runtime extensions. This reference covers the execution context, available APIs, and best practices for writing cron code.

---

## Execution Context

When a cron job runs, the following variables are available in scope:

### `context`

```typescript
interface CronContext {
  jobId: string;       // UUID of the cron job
  jobName: string;     // Human-readable job name
  triggeredBy: 'schedule' | 'manual' | 'extension';  // How the run was triggered
  runId: string;       // UUID of this specific run
  scheduledAt: string; // ISO timestamp of scheduled execution time
}
```

**Usage:**

```javascript
console.log(`Job ${context.jobName} (${context.jobId}) triggered by ${context.triggeredBy}`);
console.log(`Run ID: ${context.runId}, scheduled at: ${context.scheduledAt}`);
```

### `services`

Service factories for interacting with DaaS data:

| Service                         | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `services.items(collection)`    | Full ItemsService for CRUD on any collection (17 methods) |
| `services.collections()`        | Read/manage collection metadata                |
| `services.fields()`             | Read/manage field definitions                  |
| `services.files()`              | Upload, import, download, manage files         |
| `services.versions()`           | Content versioning — create, save, promote     |
| `services.relations()`          | Manage foreign key relations                   |
| `services.mail()`               | Send emails via SMTP (`send()`, `verify()`)    |
| `services.mail(options)`        | Send email directly (shorthand)                |
| `services.custom(name, [opts])`     | Load a reusable user-defined custom service    |
| `services.cron.trigger(idOrName)`| Trigger another cron job by ID or name         |
| `services.cron.list([status])`  | List cron jobs (optionally filter by status)   |
| `services.cron.get(idOrName)`   | Get a single cron job by ID or name            |
| `services.fetch(url, options?)` | Domain-restricted HTTP requests                |
| `services.env`                  | Whitelisted env vars (`NODE_ENV`, `NEXT_PUBLIC_SITE_URL`) |
| `services.supabase`             | Raw Supabase client (service role, bypasses RLS) |

> See [Services API reference](../../hooks-extensions/references/services-api.instructions.md) for complete method signatures.

> **Cron accountability:** Cron jobs always run as the system user (`SYSTEM_USER_ID`, `admin: true`). There is no triggering user. All service calls are already fully elevated—`{ elevated: true }` is accepted by every factory but has no additional effect.

### `console`

Standard console methods — output is captured and stored in the `logs` array of `daas_cron_history`:

```javascript
console.log('Info message');     // Captured in history logs
console.warn('Warning message'); // Captured in history logs
console.error('Error message');  // Captured in history logs
```

### Built-in Globals

Standard JavaScript built-ins are available:

- `JSON` — `parse()`, `stringify()`
- `Date` — `new Date()`, `Date.now()`, `Date.parse()`
- `Math` — `floor()`, `ceil()`, `random()`, etc.
- `Array`, `Object`, `String`, `Number`, `Boolean`
- `Map`, `Set`, `Promise`
- `parseInt`, `parseFloat`, `isNaN`, `isFinite`
- `encodeURIComponent`, `decodeURIComponent`

### Blocked Globals

These are NOT available (security restrictions):

| Blocked              | Reason                                    |
| -------------------- | ----------------------------------------- |
| `setTimeout`         | Use cron scheduling instead               |
| `setInterval`        | Use cron scheduling instead               |
| `require`            | No module loading                          |
| `import`             | No ES module imports                       |
| `eval`               | No dynamic code execution                 |
| `Function`           | No constructor-based code execution       |
| `fetch`              | No direct HTTP access from sandbox        |
| `process`            | No Node.js process access                 |

---

## ItemsService API

The most commonly used service in cron jobs:

```javascript
const items = await services.items('collection_name');
```

### Available Methods

| Method                         | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `readByQuery(query)`           | Read items with filter/sort/limit               |
| `readByQueryWithCount(query)`  | Read items + total count (for pagination)       |
| `readOne(id, query?)`          | Read a single item by ID                        |
| `readMany(ids, query?)`        | Read multiple items by IDs                      |
| `readAggregate(query)`         | Run aggregate functions (count, sum, avg, etc.) |
| `getKeysByQuery(query)`        | Get just the primary keys matching a query      |
| `createOne(data)`              | Create a single item                            |
| `createMany(dataArray)`        | Create multiple items                           |
| `updateOne(id, data)`          | Update a single item                            |
| `updateMany(ids, data)`        | Update multiple items with same data            |
| `updateByQuery(query, data)`   | Update all items matching a filter              |
| `updateBatch(items)`           | Update multiple items with different data       |
| `deleteOne(id)`                | Delete a single item                            |
| `deleteMany(ids)`              | Delete multiple items                           |
| `deleteByQuery(query)`         | Delete all items matching a filter              |

### Query Parameters

```javascript
// readByQuery() returns Item[] directly (not { data: Item[] })
const results = await items.readByQuery({
  filter: {
    status: { _eq: 'pending' },
    created_at: { _lt: cutoffDate }
  },
  fields: ['id', 'title', 'status', 'created_at'],
  sort: ['-created_at'],
  limit: 500,
  offset: 0,
});
```

### Filter Operators

| Operator         | Description              |
| ---------------- | ------------------------ |
| `_eq`            | Equals                   |
| `_neq`           | Not equals               |
| `_gt`            | Greater than             |
| `_gte`           | Greater than or equal    |
| `_lt`            | Less than                |
| `_lte`           | Less than or equal       |
| `_in`            | In array                 |
| `_nin`           | Not in array             |
| `_null`          | Is null                  |
| `_nnull`         | Is not null              |
| `_contains`      | Contains substring       |
| `_ncontains`     | Does not contain         |
| `_starts_with`   | Starts with              |
| `_ends_with`     | Ends with                |
| `_and`           | Logical AND (array)      |
| `_or`            | Logical OR (array)       |

---

## Cron Expressions

Standard 5-field syntax: `minute hour day-of-month month day-of-week`

### Field Ranges

| Field          | Allowed Values  | Special Characters     |
| -------------- | --------------- | ---------------------- |
| Minute         | 0-59            | `*` `,` `-` `/`       |
| Hour           | 0-23            | `*` `,` `-` `/`       |
| Day of month   | 1-31            | `*` `,` `-` `/`       |
| Month          | 1-12            | `*` `,` `-` `/`       |
| Day of week    | 0-7 (0,7 = Sun) | `*` `,` `-` `/`       |

### Special Characters

| Character | Meaning                                         |
| --------- | ----------------------------------------------- |
| `*`       | Every value                                     |
| `,`       | Value list separator (`1,3,5`)                  |
| `-`       | Range (`1-5` = Monday to Friday)                |
| `/`       | Step values (`*/15` = every 15 units)           |

### Common Expressions

| Expression       | Meaning                      |
| ---------------- | ---------------------------- |
| `* * * * *`      | Every minute                 |
| `*/5 * * * *`    | Every 5 minutes              |
| `*/15 * * * *`   | Every 15 minutes             |
| `*/30 * * * *`   | Every 30 minutes             |
| `0 * * * *`      | Every hour (at :00)          |
| `0 */2 * * *`    | Every 2 hours                |
| `0 */6 * * *`    | Every 6 hours                |
| `0 */12 * * *`   | Every 12 hours               |
| `0 0 * * *`      | Daily at midnight            |
| `0 9 * * *`      | Daily at 09:00               |
| `0 9 * * 1-5`    | Weekdays at 09:00            |
| `0 0 * * 0`      | Weekly (Sundays at midnight) |
| `0 0 1 * *`      | Monthly (1st at midnight)    |
| `0 0 1 1 *`      | Yearly (Jan 1st at midnight) |
| `30 2 * * 0`     | Sundays at 02:30             |
| `0 8,12,18 * * *`| Daily at 08:00, 12:00, 18:00|

### Timezone Support

All cron expressions are evaluated in the specified timezone (IANA format):

```json
{
  "schedule": "0 9 * * 1-5",
  "timezone": "Asia/Singapore"
}
```

Common timezones:
- `UTC` (default)
- `Asia/Singapore`
- `Asia/Tokyo`
- `America/New_York`
- `Europe/London`
- `Australia/Sydney`

---

## Timeout & Resource Limits

| Property          | Default | Description                                |
| ----------------- | ------- | ------------------------------------------ |
| `timeout_ms`      | 30,000  | Max execution time before forced stop      |
| `memory_limit_mb` | 64      | Max memory allocation for job execution    |

If a job exceeds `timeout_ms`, it is terminated and the history record has `status: 'timeout'`.

---

## Error Handling

Errors thrown in cron code are caught and recorded in `daas_cron_history`:

```javascript
// Errors are captured in history.error field
const items = await services.items('orders');
const { data: orders } = await items.readByQuery({
  filter: { status: { _eq: 'processing' } },
  limit: 100,
});

if (orders.length === 0) {
  console.log('No orders to process');
  return; // Early return is fine
}

for (const order of orders) {
  try {
    await items.updateOne(order.id, { status: 'shipped' });
    console.log(`Shipped order ${order.id}`);
  } catch (err) {
    console.error(`Failed to ship order ${order.id}: ${err.message}`);
    // Continue processing remaining orders
  }
}
```

---

## Best Practices

### 1. Batch with Limits

Always use `limit` in queries to avoid processing too many records at once:

```javascript
// ✅ Good: Process in batches
const { data } = await items.readByQuery({ filter: {...}, limit: 500 });

// ❌ Bad: No limit — could return millions of rows
const { data } = await items.readByQuery({ filter: {...} });
```

### 2. Log Progress

Use `console.log()` liberally — logs are captured in history and invaluable for debugging:

```javascript
console.log(`Starting job at ${new Date().toISOString()}`);
console.log(`Found ${records.length} records to process`);
// ... process ...
console.log(`Completed: ${success} succeeded, ${failed} failed`);
```

### 3. Idempotent Operations

Design jobs to be safely re-runnable:

```javascript
// ✅ Good: Only process unprocessed items
const { data } = await items.readByQuery({
  filter: { processed: { _eq: false } },
  limit: 500,
});

// ❌ Bad: Assumes items haven't been processed before
const { data } = await items.readByQuery({ limit: 500 });
```

### 4. Use Appropriate Timeouts

Set `timeout_ms` based on expected workload:

| Job Type       | Suggested Timeout |
| -------------- | ----------------- |
| Simple cleanup | 15,000 (15s)      |
| Data migration | 120,000 (2min)    |
| External sync  | 60,000 (1min)     |
| Report gen     | 30,000 (30s)      |

### 5. Test Before Activating

Always create jobs as `inactive`, test with `run_now`, check history, then `activate`:

```
create (inactive) → run_now → history (check logs) → activate
```

````
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
````instructions
---
name: Cron Sandbox Environment
description: The Engine's JavaScript runtime for cron job code — context variables, services, missing globals, and coding patterns
applyTo: "**/*.{ts,tsx,json}"
---

# Cron Sandbox Environment

On an Engine project cron jobs execute in the Engine's JavaScript runtime, the same one as runtime extensions and custom services. This reference covers the execution context, the available APIs, and best practices for writing cron code.

On an Engine project stored code (hooks, cron jobs, custom services) runs in the Engine's runtime, which provides only what the table "Engine runtime" in the [create-cron skill](../SKILL.md) lists; for each interface it lacks, the table says what replaces it.

---

## Execution Context

The code is the body of an async function in strict mode, so `await` and `return` work at the top level and assigning to an undeclared name is a `ReferenceError`. When a cron job runs, the following variables are in scope:

### `context`

```typescript
interface CronContext {
  jobId: string;       // UUID of the cron job
  jobName: string;     // The job's name when the run started
  triggeredBy: 'schedule' | 'manual' | 'extension';  // How the run was triggered
  runId: string;       // UUID of this run's history row
  scheduledAt: string; // ISO-8601 string in UTC: when the run took the job's lock
}
```

**Usage:**

```javascript
console.log(`Job ${context.jobName} (${context.jobId}) triggered by ${context.triggeredBy}`);
console.log(`Run ID: ${context.runId}, scheduled at: ${context.scheduledAt}`);
```

### `services`

Service factories for interacting with the Engine's data:

| Service                         | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `services.items(collection, opts?)` | Nine methods for CRUD on any collection (see below) |
| `services.collections()`        | Read collection metadata: `readAll`, `readOne`  |
| `services.fields()`             | Read field definitions: `readAll`, `readOne`    |
| `services.files()`              | Read file metadata: `readByQuery`, `readOne` (no upload or download) |
| `services.versions()`           | Content versions: `readAll`, `readOne`, `promote` |
| `services.relations()`          | Read relations: `readAll`, `readOne`            |
| `services.mail()`               | An object with `send(options)` and `verify()`   |
| `services.mail(options)`        | Send email directly; returns `{ success, ... }` |
| `services.custom(name, [opts])` | Load a reusable custom service; `await` it     |
| `services.cron.trigger(idOrName)`| Run another cron job by ID or name; answers its history id, `""` when it was already running |
| `services.cron.list([status])`  | List cron jobs (optionally filter by status), without their code |
| `services.cron.get(idOrName)`   | Get a single cron job by ID or name, without its code |
| `services.fetch(url, init?)`    | HTTP requests to the hosts the Engine's operator allows |
| `services.env`                  | Only the variables the Engine's operator names; empty by default |

There is no Supabase service on an Engine project: `services.supabase` is refused with `501 RUNTIME_SUPABASE_UNAVAILABLE`, and no release will add it. Write the job against `services.items`.

> For hooks and custom services, see the [hooks-extensions skill](../../hooks-extensions/SKILL.md).

> **Cron accountability:** Cron jobs always run as the Engine's system account, which holds the Administrator policy. There is no triggering user. Every service call already passes every permission check — `{ elevated: true }` is accepted but changes nothing.

### `console`

Five methods: `log`, `info` and `debug` write `INFO`, `warn` writes `WARN`, and `error` writes `ERROR`. Each call is one entry in the `logs` array of the run's `daas_cron_history` row, in the form `[<time>] [INFO|WARN|ERROR] <message>`, where `<time>` is an ISO-8601 time in UTC:

```javascript
console.log('Info message');     // [2026-10-16T01:00:00.123Z] [INFO] Info message
console.warn('Warning message'); // [2026-10-16T01:00:00.124Z] [WARN] Warning message
console.error('Error message');  // [2026-10-16T01:00:00.125Z] [ERROR] Error message
```

An object or array is written as JSON with two-space indentation, and an `Error` as its message. `console.table`, `console.trace` and the other console methods do not exist.

### Built-in Globals

The runtime passes `JSON`, `Date` and `Math` to the code, and the standard JavaScript built-ins are there:

- `JSON` — `parse()`, `stringify()`
- `Date` — `new Date()`, `Date.now()`, `Date.parse()`
- `Math` — `floor()`, `ceil()`, `random()`, etc.
- `Array`, `Object`, `String`, `Number`, `Boolean`
- `Map`, `Set`, `Promise`
- `parseInt`, `parseFloat`, `isNaN`, `isFinite`
- `encodeURIComponent`, `decodeURIComponent`

`Intl` is not available: format numbers and dates by hand.

### Missing Globals

These do not exist in the Engine's runtime; using one is a `ReferenceError` (or, for `Function`, a refusal):

| Missing              | Instead                                   |
| -------------------- | ----------------------------------------- |
| `setTimeout`         | Use the cron schedule                     |
| `setInterval`        | Use the cron schedule                     |
| `require`            | No module loading: use `services.custom`  |
| `import`             | No module loading: use `services.custom`  |
| `eval`               | No dynamic code execution                 |
| `Function`           | No constructor-based code execution       |
| `fetch`              | `services.fetch`                          |
| `process`            | `services.env`                            |
| the file system      | `services.files()` for metadata; no file access |

---

## ItemsService API

The most commonly used service in cron jobs:

```javascript
const items = services.items('collection_name');
```

### Available Methods

| Method                         | Returns                                         |
| ------------------------------ | ----------------------------------------------- |
| `readByQuery(query?)`          | The array of items itself                       |
| `readOne(id, query?)`          | The item; a missing or unreachable id throws `NOT_FOUND` |
| `readMany(ids, query?)`        | The items found; a missing id is left out       |
| `createOne(data)`              | The primary key written                         |
| `createMany(dataArray)`        | The primary keys, in one transaction            |
| `updateOne(id, data)`          | The key written                                 |
| `updateMany(ids, data)`        | The keys written, one payload for all, in one transaction |
| `deleteOne(id)`                | The key removed                                 |
| `deleteMany(ids)`              | The keys removed, in one transaction            |

There are no aggregate, count, key-only, query-wide update, batch-update or query-wide delete methods: read the keys with `readByQuery({ fields: ['id'], ... })`, then call `updateMany` or `deleteMany`.

### Query Parameters

```javascript
// readByQuery() returns Item[] directly (not { data: Item[] })
const results = await items.readByQuery({
  filter: {
    status: { _eq: 'pending' },
    created_at: { _lt: cutoffDate }
  },
  fields: ['id', 'title', 'status', 'created_at'],
  sort: ['-created_at'],
  limit: 500,
  offset: 0,
});
```

The keys are `fields`, `filter`, `sort`, `limit`, `page`, `offset` and `search`; any other key is refused, not ignored. Without `limit` a read returns 25 items, and `limit` is capped at 1000.

### Filter Operators

| Operator         | Description              |
| ---------------- | ------------------------ |
| `_eq`            | Equals                   |
| `_neq`           | Not equals               |
| `_gt`            | Greater than             |
| `_gte`           | Greater than or equal    |
| `_lt`            | Less than                |
| `_lte`           | Less than or equal       |
| `_in`            | In array                 |
| `_nin`           | Not in array             |
| `_null`          | Is null                  |
| `_nnull`         | Is not null              |
| `_contains`      | Contains substring       |
| `_ncontains`     | Does not contain         |
| `_starts_with`   | Starts with              |
| `_ends_with`     | Ends with                |
| `_and`           | Logical AND (array)      |
| `_or`            | Logical OR (array)       |

A filter may reach one relation deep — `{ 'comments.status': { _eq: 'published' } }` or `{ comments: { _has: true } }`. A path through two relations, `_some` and `_none` are refused.

---

## Cron Expressions

Standard 5-field syntax: `minute hour day-of-month month day-of-week`, or a descriptor such as `@hourly`, `@daily` or `@weekly`. A schedule that is neither is refused when the job is saved.

### Field Ranges

| Field          | Allowed Values  | Special Characters     |
| -------------- | --------------- | ---------------------- |
| Minute         | 0-59            | `*` `,` `-` `/`       |
| Hour           | 0-23            | `*` `,` `-` `/`       |
| Day of month   | 1-31            | `*` `,` `-` `/`       |
| Month          | 1-12            | `*` `,` `-` `/`       |
| Day of week    | 0-6 (0 = Sun)   | `*` `,` `-` `/`       |

### Special Characters

| Character | Meaning                                         |
| --------- | ----------------------------------------------- |
| `*`       | Every value                                     |
| `,`       | Value list separator (`1,3,5`)                  |
| `-`       | Range (`1-5` = Monday to Friday)                |
| `/`       | Step values (`*/15` = every 15 units)           |

### Common Expressions

| Expression       | Meaning                      |
| ---------------- | ---------------------------- |
| `* * * * *`      | Every minute                 |
| `*/5 * * * *`    | Every 5 minutes              |
| `*/15 * * * *`   | Every 15 minutes             |
| `*/30 * * * *`   | Every 30 minutes             |
| `0 * * * *`      | Every hour (at :00)          |
| `0 */2 * * *`    | Every 2 hours                |
| `0 */6 * * *`    | Every 6 hours                |
| `0 */12 * * *`   | Every 12 hours               |
| `0 0 * * *`      | Daily at midnight            |
| `0 9 * * *`      | Daily at 09:00               |
| `0 9 * * 1-5`    | Weekdays at 09:00            |
| `0 0 * * 0`      | Weekly (Sundays at midnight) |
| `0 0 1 * *`      | Monthly (1st at midnight)    |
| `0 0 1 1 *`      | Yearly (Jan 1st at midnight) |
| `30 2 * * 0`     | Sundays at 02:30             |
| `0 8,12,18 * * *`| Daily at 08:00, 12:00, 18:00|

### Timezone Support

All cron expressions are evaluated in the job's timezone (an IANA name). An unknown name, `Local`, or a `TZ=` prefix in the schedule is refused:

```json
{
  "schedule": "0 9 * * 1-5",
  "timezone": "Asia/Singapore"
}
```

Common timezones:
- `UTC` (default)
- `Asia/Singapore`
- `Asia/Tokyo`
- `America/New_York`
- `Europe/London`
- `Australia/Sydney`

On an Engine project the scheduler does not run yet: a cron job runs only when it is run by hand (`POST /api/cron/:id/run`). Scheduled runs are not available on an Engine project yet. Write the schedule now; it takes effect once scheduled runs are available.

---

## Timeout & Resource Limits

| Property          | Default | Description                                |
| ----------------- | ------- | ------------------------------------------ |
| `timeout_ms`      | 30,000  | Max execution time before the run is stopped |
| `memory_limit_mb` | 64      | Stored and shown; not enforced on the Engine |

If a job exceeds `timeout_ms`, the runtime stops it, including a service call in progress, and the history record has `status: 'timeout'` and the error `Cron job timed out after <timeout_ms>ms`. Nothing bounds a run's memory but its timeout: keep batches small.

---

## Error Handling

Errors thrown in cron code are caught and recorded in `daas_cron_history`, with `status: 'error'`. The `error` field holds the thrown value's message only, without the error's class name:

```javascript
// Errors are captured in the history row's error field
const items = services.items('orders');
const orders = await items.readByQuery({
  filter: { status: { _eq: 'processing' } },
  limit: 100,
});

if (orders.length === 0) {
  console.log('No orders to process');
  return; // Early return is fine
}

for (const order of orders) {
  try {
    await items.updateOne(order.id, { status: 'shipped' });
    console.log(`Shipped order ${order.id}`);
  } catch (err) {
    // err.statusCode and err.code say why: 403 FORBIDDEN, 404 NOT_FOUND, 400 INVALID_PAYLOAD
    console.error(`Failed to ship order ${order.id}: ${err.message}`);
    // Continue processing remaining orders
  }
}
```

---

## Best Practices

### 1. Batch with Limits

Always set `limit` in queries. Without it a read returns only 25 items; with it, at most 1000:

```javascript
// ✅ Good: Process in batches
const batch = await items.readByQuery({ filter: {...}, limit: 500 });

// ❌ Bad: No limit — returns only the first 25 rows
const batch = await items.readByQuery({ filter: {...} });
```

### 2. Log Progress

Use `console.log()` liberally — logs are captured in history and invaluable for debugging:

```javascript
console.log(`Starting job at ${new Date().toISOString()}`);
console.log(`Found ${records.length} records to process`);
// ... process ...
console.log(`Completed: ${success} succeeded, ${failed} failed`);
```

### 3. Idempotent Operations

Design jobs to be safely re-runnable:

```javascript
// ✅ Good: Only process unprocessed items
const pending = await items.readByQuery({
  filter: { processed: { _eq: false } },
  limit: 500,
});

// ❌ Bad: Assumes items haven't been processed before
const all = await items.readByQuery({ limit: 500 });
```

### 4. Use Appropriate Timeouts

Set `timeout_ms` based on expected workload:

| Job Type       | Suggested Timeout |
| -------------- | ----------------- |
| Simple cleanup | 15,000 (15s)      |
| Data migration | 120,000 (2min)    |
| External sync  | 60,000 (1min)     |
| Report gen     | 30,000 (30s)      |

### 5. Test Before Activating

Always create jobs as `inactive`, run them by hand (`POST /api/cron/:id/run`, or Run Now in the Studio's Cron module), check the history, then activate:

```
create (inactive) → run → history (check logs) → activate
```

````
<!-- /buildpad-backend -->
