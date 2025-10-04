package com.myauthapp

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class HelloNativeActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_hello_native)

        val title = intent.getStringExtra("title") ?: "Hello from Native Android"
        findViewById<TextView>(R.id.titleText).text = title

        findViewById<Button>(R.id.closeBtn).setOnClickListener { finish() }
    }
}
