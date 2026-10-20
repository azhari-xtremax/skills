# Native back navigation after a launched app replaces the WebView

In server-URL mode, a launched link whose host is listed in `allowNavigation`
navigates the **same** WebView in place — there's no separate browser window, no address
bar, no back button. That's the point (it's what makes this feel like one app
instead of a browser tab), but it also means there is no way back to the app's
own home screen except relaunching, unless something restores it.

## Option A — edge-swipe gesture (iOS only, minimal)

One property, no layout code, lowest risk:

```swift
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }
}
```

Set `window?.rootViewController = MainViewController()` in `SceneDelegate.swift`
in place of a bare `CAPBridgeViewController()`. This enables the same
swipe-from-the-left-edge gesture Safari/Mail/most native in-app browsers use.

Known tradeoff: an OAuth/SSO redirect chain creates several WebView history
entries (any page requiring a manual click — "Sign in with Provider" — is a real
history entry, not a silent redirect). One swipe back from inside a launched app
can land on an intermediate auth page rather than jumping straight to the app's
own home screen. Usually acceptable (one more swipe gets there); a "smart back"
that skips known auth-hop URLs in the back-forward list is possible but adds
real native complexity — only build it if the plain gesture is reported as
actually confusing in practice.

## Option B — a visible native header bar (both platforms)

For an explicit back button + page title, overlaid above the WebView's own
rendered content (not a resize of the WebView itself — see why below).

**Why an overlay, not a resize:** Capacitor's own bridge actively manages the
WebView's `.frame` (iOS) / layout (Android) on its own layout passes. A
one-time Auto Layout constraint change to make room for a header gets silently
overridden the next time Capacitor's own layout pass runs. A repeated manual
frame reassignment to fight that is a real, tested failure mode: **it produced
a completely black screen after reinstall** in testing. An overlay added as a
plain sibling view — never touching the WebView's own sizing at all — avoids
this fight entirely. The real cost: whatever's at the very top of a launched
app's own page gets visually covered while the header shows. Acceptable for
external apps not under this project's control; not something to also apply to
the project's own pages without padding them for it.

**Critical: check the navigated URL's host, not just its path.** A naive
"are we on the home path?" check (e.g. `path === '/' || path === '/dashboard'`)
breaks the moment a launched app's own root page *also* happens to be `/` —
very common, since most sites' root path is `/`. Capture the very first URL the
WebView loads (always this app's own host, since that's what `server.url`
points the initial load at) and compare every subsequent navigation's host
against that captured value, not just its path.

### iOS (KVO — does not touch Capacitor's own navigation delegate)

```swift
class MainViewController: CAPBridgeViewController {
    private static let dashboardPath = "/dashboard"
    private let headerBar = UIView()
    private let backButton = UIButton(type: .system)
    private let titleLabel = UILabel()
    private var urlObservation: NSKeyValueObservation?
    private var titleObservation: NSKeyValueObservation?
    private var homeURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupHeaderBar()   // build headerBar/backButton/titleLabel, pin headerBar
                           // to view.safeAreaLayoutGuide.topAnchor as an overlay —
                           // NOT a constraint on the webview itself
        guard let webView = self.webView else { return }
        urlObservation = webView.observe(\.url, options: [.initial, .new]) { [weak self] webView, _ in
            DispatchQueue.main.async { self?.updateHeaderVisibility(for: webView.url) }
        }
        titleObservation = webView.observe(\.title, options: [.new]) { [weak self] webView, _ in
            DispatchQueue.main.async { self?.titleLabel.text = webView.title }
        }
    }

    private func updateHeaderVisibility(for url: URL?) {
        guard let url = url else { return }
        if homeURL == nil { homeURL = url }
        let isHomeHost = url.host == homeURL?.host
        let path = url.path
        let isDashboardPath = path == Self.dashboardPath || path.isEmpty || path == "/"
        headerBar.isHidden = isHomeHost && isDashboardPath
    }

    @objc private func handleBack() {
        guard let webView = self.webView else { return }
        if webView.canGoBack {
            webView.goBack()
        } else {
            // Resolve against the app's own first URL, not the launched page:
            // a relative '/dashboard' here would load the launched host's path.
            if let home = homeURL, let dashboard = URL(string: Self.dashboardPath, relativeTo: home) {
                webView.load(URLRequest(url: dashboard))
            }
        }
    }
}
```

KVO on `webView.url`/`webView.title` is deliberate — **not** a
`WKNavigationDelegate` override. Capacitor's own `WebViewDelegationHandler` is
already the webview's navigation delegate (handling the JS bridge and
`allowNavigation`); replacing it breaks both. KVO observes the same information
without touching that delegate at all.

### Android (polling — same reasoning: don't replace Capacitor's own WebViewClient)

```java
public class MainActivity extends BridgeActivity {
    private static final String DASHBOARD_PATH = "/dashboard";
    private static final long POLL_INTERVAL_MS = 300;
    private FrameLayout headerBar;
    private TextView titleLabel;
    private final Handler pollHandler = new Handler(Looper.getMainLooper());
    private String lastUrl;
    private Uri homeUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupHeaderBar();  // add headerBar as a child of android.R.id.content,
                           // WRAP_CONTENT height, padded by the status-bar inset
    }

    @Override
    public void onResume() {
        super.onResume();
        pollHandler.postDelayed(this::pollWebView, POLL_INTERVAL_MS);
    }

    @Override
    public void onPause() {
        // Stop polling while the app is in the background.
        pollHandler.removeCallbacksAndMessages(null);
        super.onPause();
    }

    private void pollWebView() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            String url = webView.getUrl();
            if (url != null && !url.equals(lastUrl)) {
                lastUrl = url;
                updateHeaderVisibility(url);
            }
            if (headerBar.getVisibility() == View.VISIBLE) {
                titleLabel.setText(webView.getTitle());
            }
        }
        pollHandler.postDelayed(this::pollWebView, POLL_INTERVAL_MS);
    }

    private void updateHeaderVisibility(String url) {
        Uri uri = Uri.parse(url);
        if (homeUri == null) homeUri = uri;
        String homeHost = homeUri.getHost();
        boolean isHomeHost = homeHost != null && homeHost.equals(uri.getHost());
        String path = uri.getPath();
        boolean isDashboardPath = path == null || path.isEmpty() || path.equals("/") || path.equals(DASHBOARD_PATH);
        headerBar.setVisibility(isHomeHost && isDashboardPath ? View.GONE : View.VISIBLE);
    }

    private void handleBack() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            // Resolve against the app's own first URL, not the launched page:
            // a relative '/dashboard' here would load the launched host's path.
            if (homeUri != null) {
                webView.loadUrl(homeUri.buildUpon().encodedPath(DASHBOARD_PATH)
                        .clearQuery().fragment(null).build().toString());
            }
        }
    }
}
```

`onResume()` and `onPause()` must stay `public` — overriding them `protected` is a
compile error (`BridgeActivity` declares them public).

This is the same `MainActivity` class as the cookie-flushing asset
(`assets/android/MainActivity.java`, Critical Rule 11). An app that needs both
keeps one class: add this header's fields and methods to the asset's class, and
in `onResume()` / `onPause()` start and stop both the flush loop and the poll.

Polling (not overriding `WebViewClient`/`WebChromeClient`) for the same reason
as iOS's KVO choice: Capacitor's Android bridge sets up its own WebViewClient
internally, and replacing it risks breaking the JS bridge and
`allowNavigation`. Reading only the public `getUrl()`/`getTitle()` getters on a
timer can't interfere with anything Capacitor itself does.
