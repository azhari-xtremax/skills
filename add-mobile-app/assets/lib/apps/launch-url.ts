import { isNative } from '../native/platform';

/**
 * Opens an external/launched-app URL.
 *
 * On the web this is `window.open(url, '_blank')`, same as always.
 *
 * Inside the Capacitor native shell (iOS/Android), `window.open('_blank')`
 * asks for a new window, which Capacitor always hands to the system browser
 * (iOS `createWebViewWith`), whatever `server.allowNavigation` says. So we
 * navigate this same WebView instead, via a real, programmatically-clicked
 * `<a>` element. In device testing on iOS that click was accepted where a bare
 * `window.location.href = url` was rejected for the same allowed host.
 * Capacitor 8's iOS source checks `allowNavigation` by host before it looks at
 * the navigation type, so the cause of that rejection is not confirmed; the
 * anchor click works on both platforms, so keep it. See
 * references/troubleshooting.instructions.md in the add-mobile-app skill for
 * the device-log evidence.
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
  if (isNative()) {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    // Briefly attached to the DOM — the tested form was a click on an attached
    // anchor; a click on a detached element was not confirmed to behave the same.
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
