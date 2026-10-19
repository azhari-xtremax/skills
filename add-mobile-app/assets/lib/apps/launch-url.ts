import { Capacitor } from '@capacitor/core';

/**
 * Opens an external/launched-app URL.
 *
 * On the web this is `window.open(url, '_blank')`, same as always.
 *
 * Inside the Capacitor native shell (iOS/Android), `window.open('_blank')`
 * either no-ops or gets routed differently than a normal link click, so we
 * navigate via a real, programmatically-clicked `<a>` element instead of
 * `window.location.href = url`. That distinction matters: WKWebView
 * classifies a bare script-driven `location.href` assignment as navigation
 * type `.other`, and Capacitor's `server.allowNavigation` allowlist check
 * does NOT honor `.other` navigations — even for an exact-hostname allowlist
 * entry. A genuine anchor `click()` is classified as `.linkActivated`, which
 * does get the allowlist check applied. See
 * references/troubleshooting.instructions.md in the add-mobile-app skill for
 * the device-log evidence behind this.
 *
 * - A URL whose entire redirect chain stays within `server.allowNavigation`
 *   (first-party hosts that integrate with this app's own SSO) stays in this
 *   same WebView end to end, so the existing session cookie carries through
 *   the SSO hop — no redundant login.
 * - A URL outside that allowlist gets handed off to the system browser by
 *   Capacitor itself, same as clicking any other external link.
 *
 * Do NOT reach for `@capacitor/browser`'s in-app sheet here: it opens an
 * ISOLATED cookie jar (SFSafariViewController / Chrome Custom Tabs don't
 * share the WebView's cookies), which throws away the session for exactly
 * the destinations where preserving it is the whole point.
 */
export function launchAppUrl(url: string): void {
  if (Capacitor.isNativePlatform()) {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    // Briefly attached to the DOM — WebKit's `.linkActivated` navigation-type
    // classification needs a real click on an attached anchor, unlike a bare
    // `location.href` assignment or a click on a detached element.
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
