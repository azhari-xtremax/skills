# Troubleshooting — device-log evidence behind the Critical Rules

Each of these was found by hands-on testing against a real app, not from docs
alone. Keep the diagnostic method here, not just the fix — the same symptom can
have more than one cause, and the method is what tells them apart.

## allowNavigation wildcards are not reliable on iOS

**Symptom:** a catalog/launched app that should stay inside the WebView (e.g. it
shares this app's own SSO session) instead bounces to Safari/Chrome, even though
its host is covered by an `allowNavigation` entry.

**What was tried, in order, and what each ruled out:**

1. `*.partner-domain.com` (wildcard subdomain) — still bounced on iOS.
2. Switched `server.url` to the real production host (in case the wildcard
   requires HTTPS, per Capacitor's own docs note) — still bounced. **This test
   was actually invalid**: the production deployment didn't have the
   real-anchor-click fix (see below) deployed yet, so it was exercising old
   `window.open` code regardless of the config. Lesson: when testing a fix that
   spans both JS and native config, verify both are the version you think they
   are before concluding anything from the result.
3. Exact hostname, no wildcard at all (`partner-domain.com`) — **still bounced**,
   ruling out wildcard-parsing as the variable.
4. Captured live device logs during the exact tap:
   `xcrun simctl spawn <device> log show --last 1m --predicate 'process ==
   "App"' --style compact`, filtered for `decidePolicyForNavigationAction`.
   Found: `policyAction=Ignore` — Capacitor's own navigation delegate was
   explicitly rejecting the navigation, confirming the config *was* being read
   and still rejected. Not a caching or syntax issue.
5. Root cause: the navigation was being triggered via `window.location.href =
   url`. WKWebView classifies that as navigation type `.other`. Capacitor's
   `allowNavigation` check only appears to honor `.linkActivated` (a real `<a>`
   click) on iOS. Switching to a real, programmatically-clicked anchor element
   fixed it — confirmed via the same log capture, now showing `policyAction=Use`
   for the identical host.
6. Retested `'*'` (the documented "allow everything" form, confirmed real and
   working on Android — Android's `HostMask`/`Util.matches` source explicitly
   special-cases a bare `*`) **after** the real-click fix, expecting it to now
   work on iOS too. **It still bounced to Safari on iOS, while the exact same
   config worked correctly on Android.** This is a genuine platform divergence —
   not the navigation-type bug, not a stale build, not a config scope issue.
   iOS's `allowNavigation` matcher does not appear to treat `'*'` (or the
   `*.domain` wildcard form) the same way Android's documented implementation
   does. **Exact hostnames are the only form confirmed to work identically on
   both platforms.**

## The window.open / location.href navigation-type bug, in full

Any code path that opens a link — not just an app launcher — can hit this if it
uses `window.open(url, '_blank')` or a bare `location.href = url` assignment
instead of a real click.

```ts
// Does NOT reliably get allowNavigation applied on iOS:
window.location.href = url;

// Does:
const link = document.createElement('a');
link.href = url;
link.rel = 'noopener noreferrer';
link.style.display = 'none';
document.body.appendChild(link);
link.click();
link.remove();
```

The element must be briefly attached to the DOM — a `.click()` on a detached
anchor was not confirmed to get the same navigation-type classification.

**Do not "fix" this by switching to `@capacitor/browser`'s `Browser.open()`**
in-app sheet. It visually looks like it stays "in the app," but
SFSafariViewController (iOS) / Chrome Custom Tabs (Android) use an **isolated
cookie jar** — separate from the main WebView's. If the destination needs the
existing app session (SSO into an integrated product, for instance), this
throws it away and forces a fresh login every time, which is a *worse* bug than
the one being fixed, and easy to miss in testing because the sheet still visibly
opens "inside" the app.

## Android emulator: blank white screen, every HTTPS request hangs forever

**Symptom:** app shows a blank white screen indefinitely on a fresh AVD. No
error in `adb logcat` beyond repeating `SSL_connect write error 0, mark 0xf0064:
Try again` / `TLS Handshake failed`.

**Diagnostic method:** used Chrome DevTools Protocol over `adb forward` to the
WebView's `webview_devtools_remote_<pid>` socket to inspect live page state —
`document.URL` stuck at `about:blank`, every navigation ending in
`net::ERR_ABORTED` with the replacement request just hanging with no
error/timeout at all. Ruled out the app/site itself by navigating the same
WebView to a totally unrelated, definitely-working site (`example.com`) — it
hung identically. Host machine's own `curl` to the same hosts worked instantly;
the emulator could `ping 8.8.8.8` fine (which only proves ICMP, not TLS).

**Root cause:** the emulator's Private DNS was set to automatic/opportunistic
(DNS-over-TLS). That handshake was failing/hanging in-environment, and Android
holds regular traffic behind private DNS resolution while it's enabled — so
*every* HTTPS request hung, not just ones to the app's own backend.

**Fix (per-AVD-instance, not a code change):**
```bash
adb shell settings put global private_dns_mode off
```
Check this *before* assuming the app, the server, or the Capacitor config is
broken, on any fresh emulator boot showing this symptom. A real device likely
won't need it at all.

## Inspecting the WebView's cookies on a debug build

Use this when "the session isn't saved" (Critical Rule 11). A debug APK allows
`run-as`, so the WebView's cookie SQLite file can be read straight off the device:

```bash
adb exec-out "run-as <appId> cat app_webview/Default/Cookies" > Cookies.db
python3 - <<'PY'
import sqlite3, datetime
c = sqlite3.connect("Cookies.db")
t = lambda us: "session" if us == 0 else (datetime.datetime(1601,1,1)+datetime.timedelta(microseconds=us)).strftime("%Y-%m-%d %H:%M")
for host, name, exp, persistent in c.execute("select host_key,name,expires_utc,is_persistent from cookies"):
    print(host, name, "expires", t(exp), "persistent", persistent)
PY
```

Pull it at three points and compare: (1) logged in, app running, (2) after
`adb shell input keyevent KEYCODE_HOME` plus a few seconds, (3) after
`adb shell am force-stop <appId>` and relaunch.

What was observed (Next.js + Supabase SSR session cookies):

- Stage 1 (app running, user clearly logged in): the session cookie was **not yet in
  the database** — only older cookies were. This is the lazy write, not data loss.
- Stage 2 (after Home): `sb-*-auth-token.0/.1` appeared, persistent, ~400 days.
- Stage 3 (force-stop, relaunch): still logged in.

So the cookie attributes were fine; the only gap was the time before the WebView
flushed to disk, which is what `MainActivity`'s periodic flush closes.

## Android emulator: blank white screen that worked earlier

If the app rendered fine before and is now blank, with the site reachable
(`curl` returns 200, `adb shell ping` works, `private_dns_mode` is already `off`)
and a clean reinstall (`pm clear`) does not help, the emulator itself is in a bad
state — in one case after the app was backgrounded mid-login. A **cold boot**
fixed it (`adb emu kill`, then start the AVD with `-no-snapshot-load
-no-snapshot-save`; re-apply `settings put global private_dns_mode off`). Ignore
the logcat spam of `android.hardware.uwb-service` / `nfc` HAL crashes on Google
APIs images — they restart every second from boot and are unrelated.

## A plugin call does nothing: no prompt, no error

Seen with `@capacitor/local-notifications` (Critical Rules 15 and 17). The web code
swallowed the failure in a `try/catch`, the tick action worked, and nothing else
happened. How it was narrowed down:

1. `adb shell dumpsys package <appId> | grep POST_NOTIFICATIONS` showed
   `granted=false` with **no** `USER_SET` flag — the app had never even asked.
2. `unzip -p app-debug.apk assets/capacitor.plugins.json` printed `[]` — the build
   copy had a stale registry, so the plugin was never registered.
3. After copying the synced assets and rebuilding, `adb logcat` showed
   `Capacitor/Plugin: To native (Capacitor plugin): ... pluginId: LocalNotifications,
   methodName: checkPermissions / schedule`, the system permission dialog appeared,
   and `dumpsys notification --noredact | grep <appId>` listed a `NotificationRecord`
   with the title/body — the way to confirm a notification was posted even when a
   screenshot misses the heads-up banner.
4. The screen then jumped to **Alarms & reminders** for the app: the exact-alarm
   default described in Rule 17.

To drive this on an emulator without touching the UI by hand: `adb shell input tap
<x> <y>` for the controls, `adb shell cmd statusbar expand-notifications` /
`collapse` to look at the shade, and `adb logcat -c` right before the action so the
log only contains it.

## Verifying FCM end to end without a UI

1. Confirm Firebase is wired in: the APK contains the project id
   (`unzip -p app-debug.apk resources.arsc | strings | grep <project-id>`), and
   after launch `adb logcat | grep "Capacitor/Plugin.*PushNotifications"` shows
   `createChannel`, `checkPermissions`, `register`.
2. Confirm the token was saved (the `registration` listener posts it to the server;
   read the table with a service token).
3. Prove the *sender* separately from the app: sign a service-account JWT, exchange
   it at `oauth2.googleapis.com/token`, `POST fcm.googleapis.com/v1/projects/<id>/messages:send`
   to the saved token. 200 + a `name` means Firebase accepted it.
4. Prove the *device* side: foreground → `pushNotificationReceived` → your handler;
   background → a `FCM-Notification` record. A notification record's `when=` is the
   time it was posted, so `when` minus the send time is the delivery latency.
5. A DaaS cron that calls the server route can be exercised with `run_now` and read
   with `history` (the log shows the route's `{devices, sent, failed, pruned}`).

DaaS note: the static service token **overwrites `user_created`** on writes (rows come
back owned by the service account), so create/update user-owned rows with the
user's own JWT and use the static token only to read across users or delete.

## Testing a geofence on the emulator

```bash
adb emu geo fix <lon> <lat>          # note: longitude first
# register while INSIDE the zone -> immediate "enter" (initial trigger)
adb logcat -d | grep -E "Geofence transition POST|GeofenceTransitionWorker"
#   Capacitor: Geofence transition POST finished with response code: 200
adb shell dumpsys notification --noredact | grep -E "pkg=<appId>|android.title="
```

- The server log line for the first event (`geofence event keys: ...`) is the quickest
  way to learn the plugin's real native payload; `amplify_get_compute_log` with
  `filter: "geofence"` returns it.
- Don't pipe `pkill -f <script>` in the same shell command that launches the script: the
  shell's own command line matches and it kills itself (exit 144).
- Moving the emulator out and back in does **not** produce a transition (see Critical
  Rule 22); judge real entry/exit on a phone.

