package com.pablohorcajada.tablet;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Kiosk")
public class KioskPlugin extends Plugin {
    @PluginMethod
    public void exitApp(PluginCall call) {
        MainActivity activity = (MainActivity) getActivity();
        call.resolve();
        activity.runOnUiThread(activity::exitKioskMode);
    }
}
