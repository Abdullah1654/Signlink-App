package com.myauthapp

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NavigatorModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NavigatorModule"

    @ReactMethod
    fun openHelloNativeActivity(title: String) {
        val activity = currentActivity ?: return
        val intent = Intent(activity, HelloNativeActivity::class.java).apply {
            putExtra("title", title)
        }
        activity.startActivity(intent)
    }

    @ReactMethod
    fun openGestureRecognizerActivity() {
        val activity = currentActivity ?: return
        val intent = Intent(activity, GestureRecognizerActivity::class.java)
        activity.startActivity(intent)
    }
}
