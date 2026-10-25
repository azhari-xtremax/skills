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
name: Cron REST API Routes
description: DaaS cron REST API endpoints and Next.js proxy route patterns
applyTo: "**/*.{ts,tsx}"
---

# Cron REST API Routes

DaaS provides a complete REST API for managing cron jobs. All routes require **admin** authentication.

---

## DaaS Backend Endpoints

| Method   | Path                     | Description                        |
| -------- | ------------------------ | ---------------------------------- |
| `GET`    | `/api/cron`              | List all cron jobs                 |
| `POST`   | `/api/cron`              | Create a cron job                  |
| `GET`    | `/api/cron/:id`          | Get a single cron job              |
| `PATCH`  | `/api/cron/:id`          | Update + hot-reload a cron job     |
| `DELETE` | `/api/cron/:id`          | Delete job (cascades history)      |
| `POST`   | `/api/cron/:id/run`      | Manually trigger immediately       |
| `GET`    | `/api/cron/:id/history`  | Execution history for a job        |
| `GET`    | `/api/cron/history`      | Recent history across all jobs     |

---

## Create Request Body

```json
{
  "name": "Nightly Cleanup",
  "description": "Archive stale records every night",
  "schedule": "0 0 * * *",
  "timezone": "Asia/Singapore",
  "code": "console.log('Running cleanup...');",
  "status": "inactive",
  "timeout_ms": 60000
}
```

**Fields:**

| Field            | Type    | Required | Default    | Description                    |
| ---------------- | ------- | -------- | ---------- | ------------------------------ |
| `name`           | string  | Yes      | —          | Job name (max 255 chars)       |
| `description`    | string  | No       | —          | Job description                |
| `schedule`       | string  | Yes      | —          | 5-field cron expression        |
| `timezone`       | string  | No       | `UTC`      | IANA timezone string           |
| `code`           | string  | Yes      | —          | JavaScript code to execute     |
| `status`         | string  | No       | `inactive` | `active` or `inactive`         |
| `timeout_ms`     | integer | No       | 30000      | Max execution time (ms)        |
| `memory_limit_mb`| integer | No       | 64         | Max memory (MB)                |

---

## Update Request Body (PATCH)

Only include fields you want to change:

```json
{
  "schedule": "*/30 * * * *",
  "code": "console.log('Updated!');",
  "timeout_ms": 45000
}
```

Active jobs are hot-reloaded — the updated schedule takes effect immediately.

---

## History Query Parameters

```
GET /api/cron/:id/history?limit=50&offset=0
GET /api/cron/history?limit=50&offset=0
```

| Parameter | Type    | Default | Description               |
| --------- | ------- | ------- | ------------------------- |
| `limit`   | integer | 50      | Number of entries to return |
| `offset`  | integer | 0       | Pagination offset          |

---

## History Response

```json
{
  "data": [
    {
      "id": "history-uuid",
      "job_id": "job-uuid",
      "job_name": "Nightly Cleanup",
      "triggered_at": "2026-03-05T00:00:00.000Z",
      "started_at": "2026-03-05T00:00:00.050Z",
      "finished_at": "2026-03-05T00:00:02.150Z",
      "duration_ms": 2100,
      "status": "success",
      "error": null,
      "logs": ["Starting cleanup...", "Cleaned up 42 records"],
      "triggered_by": "schedule"
    }
  ]
}
```

---

## Next.js Proxy Routes

Per Rule 4 (Server-Side Proxy — No CORS), all browser-to-DaaS calls must go through Next.js API proxy routes.

### Route Structure

```
app/
  api/
    cron/
      route.ts                  →  GET /api/cron, POST /api/cron
      history/
        route.ts                →  GET /api/cron/history
      [id]/
        route.ts                →  GET, PATCH, DELETE /api/cron/:id
        run/
          route.ts              →  POST /api/cron/:id/run
        history/
          route.ts              →  GET /api/cron/:id/history
```

### List & Create — `app/api/cron/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  return proxyToDaaS(request, '/api/cron');
}

export async function POST(request: NextRequest) {
  return proxyToDaaS(request, '/api/cron');
}
```

### Global History — `app/api/cron/history/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';
  return proxyToDaaS(request, `/api/cron/history?limit=${limit}&offset=${offset}`);
}
```

### Single Job CRUD — `app/api/cron/[id]/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}`);
}
```

### Manual Trigger — `app/api/cron/[id]/run/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToDaaS(request, `/api/cron/${id}/run`);
}
```

### Job History — `app/api/cron/[id]/history/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { proxyToDaaS } from '@/lib/proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';
  return proxyToDaaS(request, `/api/cron/${id}/history?limit=${limit}&offset=${offset}`);
}
```

---

## Database Tables

### `daas_cron_jobs`

```
id              uuid  PK
name            varchar(255)
description     text
schedule        varchar(100)     -- 5-field cron expression
timezone        varchar(64)      -- default UTC
code            text
status          enum: active | inactive
timeout_ms      integer          -- default 30000
memory_limit_mb integer          -- default 64
running         boolean          -- overlap lock
running_since   timestamptz
last_run_at     timestamptz
last_run_status enum: running | success | error | timeout
next_run_at     timestamptz      -- pre-computed for display
created_at / updated_at / created_by / updated_by
```

### `daas_cron_history`

```
id              uuid  PK
job_id          uuid  FK → daas_cron_jobs (ON DELETE CASCADE)
job_name        text  (denormalized)
triggered_at    timestamptz
started_at      timestamptz
finished_at     timestamptz
duration_ms     integer
status          enum: running | success | error | timeout
error           text
logs            text[]           -- captured console.log lines
triggered_by    enum: schedule | manual
```

---

## Environment Variables

| Variable                 | Default | Description                     |
| ------------------------ | ------- | ------------------------------- |
| `CRON_ENABLED`           | `true`  | Set `false` to disable all jobs |
| `CRON_HISTORY_RETENTION` | `100`   | History rows kept per job       |

---

## Overlap Protection

If a job is still running when the next scheduled tick fires, the tick is skipped. The `running` boolean in `daas_cron_jobs` is set atomically before execution and cleared on completion.

If the process crashes mid-job, `running` stays `true`. The flag can be ignored after `timeout_ms * 2` has elapsed.

---

## History Retention

Default: **100 rows per job**. Old rows are pruned automatically after each run via the `prune_cron_history` PostgreSQL function.

---

## Related

- [Cron sandbox environment](./cron-sandbox.instructions.md)
- [Cron MCP tool](./cron-mcp.instructions.md)
- [DaaS API reference](../../daas-platform/references/daas-api.instructions.md)

````
<!-- /buildpad-backend -->
<!-- buildpad-backend: engine -->
````instructions
---
name: Cron REST API Routes
description: The Engine's cron REST API endpoints and Next.js proxy route patterns
applyTo: "**/*.{ts,tsx}"
---

# Cron REST API Routes

On an Engine project the Engine provides a complete REST API for managing cron jobs, at `<Engine_URL>/api/cron`. Each route is decided by the caller's grant on the collection `daas_cron_jobs`; an administrator passes every check. A grant on `daas_cron_history` opens nothing. The Studio's Cron module uses the same routes. The Engine's MCP tool `cron`, listed and served to an administrator only, makes the same changes.

On an Engine project every data call carries the signed-in user's access token as `Authorization: Bearer <access token>`, from the application's own server route or from the SDK. The Engine accepts no cookie session on its data API. The token in the project's MCP configuration is accepted only on the MCP endpoint `/api/mcp`: never send it, or any other administrator token, to the data API.

---

## Engine Endpoints

| Method   | Path                     | Needs on `daas_cron_jobs` | Description                        |
| -------- | ------------------------ | ------------------------- | ---------------------------------- |
| `GET`    | `/api/cron`              | `read`                    | List cron jobs (`search`, `status`, `page`, `limit`) |
| `POST`   | `/api/cron`              | `create`                  | Create a cron job (answers `201`)  |
| `GET`    | `/api/cron/:id`          | `read`                    | Get a single cron job              |
| `PATCH`  | `/api/cron/:id`          | `update`                  | Update the fields sent             |
| `DELETE` | `/api/cron/:id`          | `delete`                  | Delete job (cascades history); answers `200` with `{ success, message }` |
| `POST`   | `/api/cron/:id/run`      | `update`                  | Run the job now; answers when the run has ended |
| `POST`   | `/api/cron/:id/clone`    | `create` and `read`       | Copy a job; the copy is inactive   |
| `GET`    | `/api/cron/:id/history`  | `read`                    | Execution history for a job        |
| `GET`    | `/api/cron/history`      | `read`                    | Recent history across all jobs     |

A field the caller's read grant withholds is absent from a job, `code` above all; do not treat it as empty.

---

## Create Request Body

```json
{
  "name": "Nightly Cleanup",
  "description": "Archive stale records every night",
  "schedule": "0 0 * * *",
  "timezone": "Asia/Singapore",
  "code": "console.log('Running cleanup...');",
  "status": "inactive",
  "timeout_ms": 60000
}
```

**Fields:**

| Field            | Type    | Required | Default    | Description                    |
| ---------------- | ------- | -------- | ---------- | ------------------------------ |
| `name`           | string  | Yes      | —          | Job name (max 255 chars)       |
| `description`    | string  | No       | —          | Job description                |
| `schedule`       | string  | Yes      | —          | 5-field cron expression, or a descriptor such as `@hourly` |
| `timezone`       | string  | No       | `UTC`      | IANA timezone string           |
| `code`           | string  | Yes      | —          | JavaScript code to execute; it must compile |
| `status`         | string  | No       | `inactive` | `active` or `inactive`         |
| `timeout_ms`     | integer | No       | 30000      | Max execution time (ms), positive |
| `memory_limit_mb`| integer | No       | 64         | Stored and shown; not enforced |

A missing required field, a schedule that is not a cron expression, an unknown timezone, code that does not compile, or a non-positive limit is refused with `400 INVALID_PAYLOAD` and a sentence that names the field. Nothing is stored.

---

## Update Request Body (PATCH)

Only include fields you want to change:

```json
{
  "schedule": "*/30 * * * *",
  "code": "console.log('Updated!');",
  "timeout_ms": 45000
}
```

Only the fields sent are written; a known field with a value its column cannot hold is refused, not dropped. `{ "status": "active" }` activates a job and `{ "status": "inactive" }` deactivates it.

On an Engine project an active cron job fires at its scheduled time. `POST /api/cron/:id/run` runs a job by hand at any time.

---

## Run Response

```json
{
  "data": {
    "historyId": "history-uuid",
    "message": "Cron job Nightly Cleanup triggered manually"
  }
}
```

An empty `historyId` means the job was already running and nothing ran. A run whose code failed still answers `200`: read its outcome from the history row.

---

## History Query Parameters

```
GET /api/cron/:id/history?limit=50&offset=0
GET /api/cron/history?limit=50&offset=0
```

| Parameter | Type    | Default | Description               |
| --------- | ------- | ------- | ------------------------- |
| `limit`   | integer | 50      | Number of entries to return |
| `offset`  | integer | 0       | Pagination offset          |
| `page`    | integer | —       | Page number, instead of `offset` |

---

## History Response

```json
{
  "data": [
    {
      "id": "history-uuid",
      "job_id": "job-uuid",
      "job_name": "Nightly Cleanup",
      "triggered_at": "2026-03-05T00:00:00.000Z",
      "started_at": "2026-03-05T00:00:00.050Z",
      "finished_at": "2026-03-05T00:00:02.150Z",
      "duration_ms": 2100,
      "status": "success",
      "error": null,
      "logs": [
        "[2026-03-05T00:00:00.060Z] [INFO] Starting cleanup...",
        "[2026-03-05T00:00:02.140Z] [INFO] Cleaned up 42 records"
      ],
      "triggered_by": "manual"
    }
  ],
  "meta": { "total_count": 1, "filter_count": 1, "page": 1, "limit": 50, "offset": 0, "total_pages": 1 }
}
```

Each `logs` entry is one console call, in the form `[<time>] [INFO|WARN|ERROR] <message>`. `error` holds the thrown value's message, without the error's class name.

---

## Next.js Proxy Routes

The Cron Jobs module ([add-cron skill](../../add-cron/SKILL.md)) calls the Engine directly from the browser with the user's access token and needs none of these routes. Write them for an app's own server-side or custom calls. Each route forwards the signed-in user's `Authorization` header to the Engine and passes the Engine's status and `{ errors: [...] }` body through unchanged. On an Engine project the data API accepts requests from any origin and never with cookies, as the project is provisioned. Change no cross-origin setting, and do not add the application's origin anywhere.

### Route Structure

```
lib/
  engine-forward.ts             →  forwardToEngine(request, path)
app/
  api/
    cron/
      route.ts                  →  GET /api/cron, POST /api/cron
      history/
        route.ts                →  GET /api/cron/history
      [id]/
        route.ts                →  GET, PATCH, DELETE /api/cron/:id
        run/
          route.ts              →  POST /api/cron/:id/run
        history/
          route.ts              →  GET /api/cron/:id/history
```

### The Forwarder — `lib/engine-forward.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

export async function forwardToEngine(request: NextRequest, path: string) {
  const headers = await getAuthHeaders();
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const response = await fetch(`${getDaasUrl()}${path}${request.nextUrl.search}`, {
    method: request.method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  });
  const text = await response.text();
  return new NextResponse(text || null, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' },
  });
}
```

### List & Create — `app/api/cron/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { forwardToEngine } from '@/lib/engine-forward';

export async function GET(request: NextRequest) {
  return forwardToEngine(request, '/api/cron');
}

export async function POST(request: NextRequest) {
  return forwardToEngine(request, '/api/cron');
}
```

### Global History — `app/api/cron/history/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { forwardToEngine } from '@/lib/engine-forward';

// The query string (limit, offset, page) is forwarded as received.
export async function GET(request: NextRequest) {
  return forwardToEngine(request, '/api/cron/history');
}
```

### Single Job CRUD — `app/api/cron/[id]/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { forwardToEngine } from '@/lib/engine-forward';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardToEngine(request, `/api/cron/${id}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardToEngine(request, `/api/cron/${id}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardToEngine(request, `/api/cron/${id}`);
}
```

### Manual Trigger — `app/api/cron/[id]/run/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { forwardToEngine } from '@/lib/engine-forward';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardToEngine(request, `/api/cron/${id}/run`);
}
```

### Job History — `app/api/cron/[id]/history/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { forwardToEngine } from '@/lib/engine-forward';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardToEngine(request, `/api/cron/${id}/history`);
}
```

---

## Database Tables

### `daas_cron_jobs`

```
id              uuid  PK
name            varchar(255)
description     text
schedule        varchar(100)     -- 5-field cron expression or descriptor
timezone        varchar(64)      -- default UTC
code            text
status          active | inactive  -- default inactive
timeout_ms      integer          -- default 30000
memory_limit_mb integer          -- default 64, not enforced
running         boolean          -- overlap lock
running_since   timestamptz
last_run_at     timestamptz
last_run_status running | success | error | timeout
next_run_at     timestamptz      -- pre-computed for display
created_at / updated_at / created_by / updated_by
```

### `daas_cron_history`

```
id              uuid  PK
job_id          uuid  FK → daas_cron_jobs (ON DELETE CASCADE)
job_name        varchar(255)  (denormalized)
triggered_at    timestamptz      -- the lock time
started_at      timestamptz
finished_at     timestamptz
duration_ms     integer
status          running | success | error | timeout
error           text
logs            text[]           -- one "[<time>] [LEVEL] <message>" entry per console call
triggered_by    schedule | manual | extension
```

Both tables are the Engine's. Change them only through the routes above.

---

## Engine Settings

These are settings of the Engine, made by its operator, not variables of the application:

| Variable                   | Default | Description                                          |
| -------------------------- | ------- | ---------------------------------------------------- |
| `CRON_ENABLED`             | `true`  | `false` stops scheduled runs; manual runs still work |
| `CRON_HISTORY_RETENTION`   | `100`   | History rows kept per job                            |
| `CRON_STALE_LOCK_GRACE_MS` | `30000` | Added to a job's `timeout_ms` before a lock left by a stopped process is taken over |

---

## Overlap Protection

A job never runs twice at once. Before its code runs, a run sets the `running` lock on its job; a run that finds the lock held is skipped. If the process stops mid-run, `running` stays `true` until `timeout_ms` plus `CRON_STALE_LOCK_GRACE_MS` has passed; then the next run takes the lock over, and the old history row stays `running` as the record of the stopped run.

---

## History Retention

Default: **100 rows per job**. Older rows of that job are removed after each run.

---

## Related

- [Cron sandbox environment](./cron-sandbox.instructions.md)
- [create-cron skill](../SKILL.md)
- [DaaS platform skill](../../daas-platform/SKILL.md)

````
<!-- /buildpad-backend -->
