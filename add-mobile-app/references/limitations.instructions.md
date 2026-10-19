# What this approach genuinely does not give you

Say these plainly when scoping whether to use this approach at all — they're not
solved by more effort within this approach, only by a different one (e.g. a full
native rewrite).

- **It's still a WebView, not a native UI.** Scrolling, transitions, and overall
  feel are the browser's, not the OS's. Fine for an internal tool reusing 100%
  of an existing app's code; not a substitute for a genuinely native
  performance/feel requirement.
- **No address bar means no way for the user to tell "you've left the real
  app."** This is exactly why `allowNavigation` defaults to bouncing unlisted
  hosts out to the system browser — it's a real security boundary, not an
  arbitrary restriction. Setting it to allow everything (even where that's
  technically possible) removes the one visual cue protecting the user from a
  convincingly-embedded phishing page on a compromised or malicious destination.
- **Some destinations flatly refuse to be embedded, and there is no app-side
  workaround.** An alternative design of showing another page inside an
  `<iframe>` with a custom header on top was tried and shelved: many real sites
  (Atlassian, Google among them) block iframe embedding by policy, as a
  deliberate security measure (`X-Frame-Options` / CSP `frame-ancestors`). This
  is why server-URL mode navigates the main WebView in place instead of trying
  to frame destinations.
- **Every native device capability (camera, location, etc.) is its own small
  integration**, not something that comes free from wrapping the web app.
  Permission strings must be added to each platform's native project files
  separately (`Info.plist` / `AndroidManifest.xml`) in addition to any JS
  plugin code — skipping this produces a runtime crash or silent permission
  denial, not a build error, so it's easy to miss until actually testing the
  feature on-device.
- **A release build needs its own signing setup** (an Apple signing certificate
  + provisioning profile, an Android release keystore) that this guide does not
  cover — a debug build only installs by sideloading, not through either app
  store.
