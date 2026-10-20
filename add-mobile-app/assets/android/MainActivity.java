package com.company.appname; // <- change to your appId

import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.webkit.CookieManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Android's WebView keeps cookies in memory and writes them to disk lazily.
    // Without a flush, a login cookie set just before the process dies is lost
    // and the user is signed out on the next launch. flush() blocks until the
    // cookies are on disk, so it runs once on pause, and periodically while
    // visible (for a process killed without a pause) on a background thread,
    // never on the UI thread.
    private static final long FLUSH_INTERVAL_MS = 2000;

    private HandlerThread flushThread;
    private Handler flushHandler;
    private final Runnable flushLoop = new Runnable() {
        @Override
        public void run() {
            CookieManager.getInstance().flush();
            flushHandler.postDelayed(this, FLUSH_INTERVAL_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        flushThread = new HandlerThread("cookie-flush");
        flushThread.start();
        flushHandler = new Handler(flushThread.getLooper());
    }

    @Override
    public void onResume() {
        super.onResume();
        flushHandler.postDelayed(flushLoop, FLUSH_INTERVAL_MS);
    }

    @Override
    public void onPause() {
        flushHandler.removeCallbacks(flushLoop);
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    public void onDestroy() {
        flushThread.quitSafely();
        super.onDestroy();
    }
}
