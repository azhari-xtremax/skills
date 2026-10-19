package com.company.appname; // <- change to your appId

import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Android's WebView keeps cookies in memory and writes them to disk lazily.
    // Without a flush, a login cookie set just before the app is swiped away or
    // killed is lost and the user is signed out on the next launch. Flushing on
    // pause/stop is not enough on its own: the flush is asynchronous and the
    // process can die right after, so also flush periodically while visible.
    private static final long FLUSH_INTERVAL_MS = 2000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable flushLoop = new Runnable() {
        @Override
        public void run() {
            CookieManager.getInstance().flush();
            handler.postDelayed(this, FLUSH_INTERVAL_MS);
        }
    };

    @Override
    public void onResume() {
        super.onResume();
        handler.postDelayed(flushLoop, FLUSH_INTERVAL_MS);
    }

    @Override
    public void onPause() {
        handler.removeCallbacks(flushLoop);
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    public void onStop() {
        CookieManager.getInstance().flush();
        super.onStop();
    }
}
