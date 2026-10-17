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

# Security

## Sandbox

```
sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-storage-access-by-user-activation"
```

| Flag                                     | Status                        | Reason                                                                        |
| ---------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `allow-scripts`                          | required                      | The micro-app is a Next.js app.                                               |
| `allow-same-origin`                      | required                      | Cookies and storage on the micro-app origin.                                  |
| `allow-forms`                            | required                      | Form submission.                                                              |
| `allow-popups`                           | required                      | External links, OAuth windows, **and the Files module download** — `file-manager.tsx` and `file-detail.tsx` download with `window.open` to a signed cross-origin URL. |
| `allow-downloads`                        | required                      | CSV export and Files-module downloads. The download runs in a popup that inherits this sandbox, so `allow-popups` and `allow-downloads` are required **together**. `allow-popups-to-escape-sandbox` is not needed, because `allow-downloads` is inherited. |
| `allow-storage-access-by-user-activation`| required                      | Lets the frame call `document.requestStorageAccess()` when a browser blocks partitioned cookies. Without it the documented fallback is unreachable. |
| `allow-popups-to-escape-sandbox`         | only with `add-external-oauth`| A popup inherits this sandbox otherwise, and the OAuth flow fails.            |
| `allow-modals`                           | forbidden                     | Its absence is what blocks `window.confirm`. Micro-apps use Mantine `Modal`.  |
| `allow-top-navigation`                   | forbidden                     | It lets a micro-app replace the host page.                                    |

Native dialogs are blocked by the missing `allow-modals` flag, not by a browser policy.
Do not add the flag to make a dialog work — and audit for calls the CLI itself ships
(`rich-text-markdown.tsx` contains a `window.prompt`); see SKILL Step 4.

Do not trim `allow-popups` from an app that has no OAuth and no external links. A/B
runs against the real Files row-menu download inside the frame:

| Sandbox | Result |
| --- | --- |
| `DEFAULT_SANDBOX` as shipped | the file lands (90,089 bytes) |
| minus `allow-downloads` | 0 downloads — "the frame … is sandboxed, but the flag allow-downloads is not set" |
| minus `allow-popups` | 0 downloads — "Blocked opening '…/storage/v1/object/sign/…' in a new window because the request was made in a sandboxed frame whose 'allow-popups' permission is not set" |

**Run download assertions headed.** Headless Chromium silently drops this
popup-download and reports zero downloads whether or not the flags are present, so a
headless suite passes over a broken sandbox.

## Message validation

Every handler runs three checks before it reads a payload.

```ts
if (event.origin !== expectedOrigin) return;
if (event.source !== iframeRef.current?.contentWindow) return;  // host side
if (event.source !== window.parent) return;                     // micro-app side
if (!isBridgeMessage(event.data) || event.data.v !== BRIDGE_VERSION) return;
```

The origin check alone is not enough. Two frames of the same micro-app on one page each
pass an origin check for the other's messages. A same-origin popup or a nested frame
passes it too.

Validate the payload shape after the envelope. `typeof params !== 'object'` and
`typeof access_token !== 'string'` are not optional.

Never pass `'*'` as the target origin of a `postMessage` call.

## Clickjacking — both directions

`frame-src` restricts what an app may **embed**. It does nothing to stop the app
**being embedded** — that is `frame-ancestors`, and both sides need one:

- **Host**: `frame-ancestors 'none'` — it holds the real Supabase session, the
  sign-out control, and the scope switcher. Nothing may frame it.
- **Micro-app**: `frame-ancestors 'self' <HOST_ORIGIN>` — only the host may frame it.

`X-Frame-Options` cannot list more than one origin, so use CSP. **A Buildpad starter
ships no `next.config.ts` — create it.** The complete files (with the relative-import
and `NODE_ENV` rules) are in SKILL Step 5; the traps are worth restating:

1. The snippet must be a whole module with `export default` — a bare `headers()`
   method is a syntax error in an empty file.
2. `@/…` aliases do not resolve from the Next config loader. Import
   `./config/app-urls` relatively. Never hardcode an origin literal — it drifts the
   day any app moves to a custom domain.
3. Gate `http://localhost:*` entries on `NODE_ENV === 'development'`. A production
   header advertising localhost invites any local server on the visitor's machine to
   frame the app. Verify with `jq '.headers' .next/routes-manifest.json` after a
   production build: real origins present, no `http://localhost`.

A `frame-ancestors` mismatch is invisible to the host: the load failure is opaque. The
load watchdog in `useMicroappHost` is what surfaces it.

## Cookies

Bridge cookies are set inside a cross-site frame, so they need
`SameSite=None; Secure; Partitioned` — see `assets/shared/mfe-cookies.ts`
(`framedCookieOptions`) and the cookie rules in
[auth-bridge](auth-bridge.instructions.md). Never write a cookie name or option set as
a literal.

| Cookie              | httpOnly | Read by                                       |
| ------------------- | -------- | --------------------------------------------- |
| `mfe_access_token`  | yes      | middleware (`getMfeUser`), `/api/auth/token`, `auth-headers.ts` |
| `mfe_expires_at`    | no       | `MicroappBridgeProvider`, to schedule renewal |
| `daas_resource_uri` | no       | `DaaSProvider.getHeaders` (scope projects only) |

`SUPABASE_SERVICE_ROLE_KEY` never reaches client code, in any app.

`Secure` is exempted on `http://localhost`, but any other plain-HTTP dev origin
(a LAN IP, `*.local`, a container hostname) silently loses every bridge cookie — use
`localhost` ports for local dev.

## CORS

The DaaS **default** is `cors_origins: ["*"]` with `cors_allow_credentials: false` —
which blocks every credentialed browser call, because the Fetch spec discards a
credentialed response carrying `Access-Control-Allow-Origin: *`. (`X-Resource-Uri` is
already in the default `cors_allowed_headers` on DaaS ≥ 0.1.92 — keep it in the list
anyway when updating.)

The runnable update call and its `curl` verification are in SKILL Step 6
(`mcp_daas_cors-settings`, or `PATCH /api/settings/cors`). List every origin that
calls DaaS: the Main App, every micro-app, and every local development port.

## Checklist

- [ ] The sandbox matches `DEFAULT_SANDBOX` — no `allow-modals`, no
      `allow-top-navigation`, `allow-popups`, `allow-downloads` and
      `allow-storage-access-by-user-activation` present.
- [ ] A real download inside the frame produces a file, asserted in a **headed**
      browser. A headless run cannot verify this flag pair.
- [ ] Every handler checks origin, `event.source`, `source`, and `v`.
- [ ] Every payload field is type-checked before use.
- [ ] The host sets `frame-ancestors 'none'` AND `frame-src` for the micro-app origins.
- [ ] Each micro-app sets `frame-ancestors 'self' <HOST_ORIGIN>`.
- [ ] No `http://localhost` in any production `routes-manifest.json` header.
- [ ] Bridge cookies use `framedCookieOptions` (None + Secure + Partitioned).
- [ ] The Step 6 `curl` echoes the origin and `access-control-allow-credentials: true`.
