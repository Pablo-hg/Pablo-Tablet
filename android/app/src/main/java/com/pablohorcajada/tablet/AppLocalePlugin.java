package com.pablohorcajada.tablet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppLocale")
public final class AppLocalePlugin extends Plugin {
    @PluginMethod
    public void setLanguage(PluginCall call) {
        String language = call.getString("language");
        if (!"es".equals(language) && !"en".equals(language)) {
            call.reject(AppLocale.text(getContext(), R.string.error_language_not_supported));
            return;
        }
        AppLocale.setLanguage(getContext(), language);
        MobileAdminServiceController.reconcile(getContext());
        JSObject result = new JSObject();
        result.put("language", language);
        call.resolve(result);
    }

    @PluginMethod
    public void getLanguage(PluginCall call) {
        JSObject result = new JSObject();
        result.put("language", AppLocale.language(getContext()));
        call.resolve(result);
    }
}
