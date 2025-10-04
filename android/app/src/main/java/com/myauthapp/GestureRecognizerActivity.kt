package com.myauthapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.floatingactionbutton.FloatingActionButton

class GestureRecognizerActivity : AppCompatActivity() {
    
    private var gestureRecognizerView: GestureRecognizerView? = null
    private var sttHelper: SttHelper? = null
    private var isInSpeechMode = false
    private val MICROPHONE_PERMISSION_REQUEST = 1001
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_gesture_recognizer)

        gestureRecognizerView = findViewById(R.id.gesture_recognizer_view)
        
        // Initialize STT helper
        sttHelper = SttHelper(this).apply {
            onResult = { text ->
                runOnUiThread {
                    // Add the spoken text as a sentence
                    gestureRecognizerView?.addSpokenSentence(text)
                    Toast.makeText(this@GestureRecognizerActivity, "Added: $text", Toast.LENGTH_SHORT).show()
                    // Stay in speech mode - user can speak again or manually return to gesture mode
                }
            }
            
            onError = { error ->
                runOnUiThread {
                    Toast.makeText(this@GestureRecognizerActivity, "Speech Error: $error", Toast.LENGTH_SHORT).show()
                    // Stay in speech mode - user can try again or manually return to gesture mode
                }
            }
            
            onListeningStateChanged = { isListening ->
                runOnUiThread {
                    // Update mic button appearance based on listening state
                    val micBtn = findViewById<FloatingActionButton>(R.id.micBtn)
                    if (isListening) {
                        micBtn?.setImageResource(android.R.drawable.ic_media_pause) // Show pause icon when listening
                    } else {
                        micBtn?.setImageResource(android.R.drawable.ic_btn_speak_now) // Show mic icon when not listening
                    }
                }
            }
        }
        
        // Set up close button
        findViewById<FloatingActionButton>(R.id.closeBtn)?.setOnClickListener { finish() }
        
        // Set up camera flip button
        findViewById<FloatingActionButton>(R.id.cameraFlipBtn)?.setOnClickListener {
            gestureRecognizerView?.toggleCamera()
        }
        
        // Set up microphone button
        findViewById<FloatingActionButton>(R.id.micBtn)?.setOnClickListener {
            if (!isInSpeechMode && checkMicrophonePermission()) {
                // Enter speech mode
                gestureRecognizerView?.pauseGestureRecognition()
                sttHelper?.startListening()
                isInSpeechMode = true
                // Show return to gesture button below mic button
                findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.visibility = android.view.View.VISIBLE
                Toast.makeText(this, "Speech mode activated. Click ↩️ to return to gestures.", Toast.LENGTH_LONG).show()
            } else if (isInSpeechMode) {
                // In speech mode - toggle listening on/off
                if (sttHelper?.isCurrentlyListening() == true) {
                    sttHelper?.stopListening()
                } else {
                    sttHelper?.startListening()
                }
            }
        }
        
        // Set up return to gesture button
        findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.setOnClickListener {
            // Return to gesture mode
            sttHelper?.stopListening()
            gestureRecognizerView?.resumeGestureRecognition()
            isInSpeechMode = false
            // Hide return to gesture button
            findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.visibility = android.view.View.GONE
            // Reset mic button icon to default
            findViewById<FloatingActionButton>(R.id.micBtn)?.setImageResource(android.R.drawable.ic_btn_speak_now)
            Toast.makeText(this, "Returned to gesture recognition mode", Toast.LENGTH_SHORT).show()
        }
        
        // Initially hide return to gesture button
        findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.visibility = android.view.View.GONE
    }
    
    private fun checkMicrophonePermission(): Boolean {
        return if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                MICROPHONE_PERMISSION_REQUEST
            )
            false
        } else {
            true
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == MICROPHONE_PERMISSION_REQUEST) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // Permission granted, start speech recognition
                gestureRecognizerView?.pauseGestureRecognition()
                sttHelper?.startListening()
                isInSpeechMode = true
                // Show return to gesture button below mic button
                findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.visibility = android.view.View.VISIBLE
                Toast.makeText(this, "Speech mode activated. Click ↩️ to return to gestures.", Toast.LENGTH_LONG).show()
            } else {
                Toast.makeText(this, "Microphone permission is required for speech recognition", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    
    override fun onDestroy() {
        super.onDestroy()
        sttHelper?.cleanup()
    }
}
