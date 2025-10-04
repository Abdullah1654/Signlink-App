package com.myauthapp

import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class HelloNativeViewManager(private val appContext: ReactApplicationContext)
    : SimpleViewManager<LinearLayout>() {

    override fun getName(): String = "HelloNativeView"

    override fun createViewInstance(reactContext: ThemedReactContext): LinearLayout {
        val layout = LinearLayout(reactContext).apply {
            orientation = LinearLayout.VERTICAL
            val pad = (16 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }

        val titleView = TextView(reactContext).apply {
            text = "Hello from a Native View"
            textSize = 18f
            id = android.view.View.generateViewId()
        }

        val button = Button(reactContext).apply {
            text = "Press Me"
            setOnClickListener {
                android.widget.Toast
                    .makeText(reactContext, "Native button clicked!", android.widget.Toast.LENGTH_SHORT)
                    .show()
            }
        }

        layout.addView(titleView)
        layout.addView(button)
        layout.tag = titleView  // keep a reference for prop updates
        return layout
    }

    @ReactProp(name = "title")
    fun setTitle(view: LinearLayout, title: String?) {
        val tv = view.tag as? TextView
        tv?.text = title ?: "Hello from a Native View"
    }
}
