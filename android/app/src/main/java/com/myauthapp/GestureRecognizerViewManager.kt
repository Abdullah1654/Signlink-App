package com.myauthapp

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class GestureRecognizerViewManager : SimpleViewManager<GestureRecognizerView>() {
    override fun getName(): String = "GestureRecognizerView"

    override fun createViewInstance(reactContext: ThemedReactContext): GestureRecognizerView {
        return GestureRecognizerView(reactContext)
    }
}
