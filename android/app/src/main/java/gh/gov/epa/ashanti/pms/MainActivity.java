package gh.gov.epa.ashanti.pms;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Behave like a native app: ignore the phone's system font-size setting
        // (which scales WebView text and breaks layouts) and disable zooming.
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
    }
}
