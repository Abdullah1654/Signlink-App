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
        try {
            setContentView(R.layout.activity_gesture_recognizer)

            gestureRecognizerView = findViewById(R.id.gesture_recognizer_view)
            
            if (gestureRecognizerView == null) {
                Toast.makeText(this, "Failed to initialize camera view", Toast.LENGTH_SHORT).show()
                finish()
                return
            }
            
            // Initialize STT helper
            sttHelper = SttHelper(this).apply {
                onResult = { text ->
                    try {
                        runOnUiThread {
                            if (!isFinishing && !isDestroyed) {
                                gestureRecognizerView?.addSpokenSentence(text)
                                Toast.makeText(this@GestureRecognizerActivity, "Added: $text", Toast.LENGTH_SHORT).show()
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("GestureRecognizer", "Error handling speech result: ${e.message}")
                    }
                }
                
                onError = { error ->
                    try {
                        runOnUiThread {
                            if (!isFinishing && !isDestroyed) {
                                Toast.makeText(this@GestureRecognizerActivity, error, Toast.LENGTH_SHORT).show()
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("GestureRecognizer", "Error handling speech error: ${e.message}")
                    }
                }
                
                onListeningStateChanged = { isListening ->
                    try {
                        runOnUiThread {
                            if (!isFinishing && !isDestroyed) {
                                val micBtn = findViewById<FloatingActionButton>(R.id.micBtn)
                                if (isListening) {
                                    micBtn?.setImageResource(android.R.drawable.ic_media_pause)
                                } else {
                                    micBtn?.setImageResource(android.R.drawable.ic_btn_speak_now)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("GestureRecognizer", "Error updating mic button: ${e.message}")
                    }
                }
            }
        
        // Set up close button
        findViewById<FloatingActionButton>(R.id.closeBtn)?.setOnClickListener {
            try {
                if (isInSpeechMode) {
                    cleanupSpeechMode()
                }
                finish()
            } catch (e: Exception) {
                android.util.Log.e("GestureRecognizer", "Error closing activity: ${e.message}")
                finish()
            }
        }
        
        // Set up camera flip button
        findViewById<FloatingActionButton>(R.id.cameraFlipBtn)?.setOnClickListener {
            try {
                gestureRecognizerView?.toggleCamera()
            } catch (e: Exception) {
                android.util.Log.e("GestureRecognizer", "Error toggling camera: ${e.message}")
                Toast.makeText(this, "Failed to switch camera", Toast.LENGTH_SHORT).show()
            }
        }
        
        // Set up microphone button
        findViewById<FloatingActionButton>(R.id.micBtn)?.setOnClickListener {
            try {
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
            } catch (e: Exception) {
                android.util.Log.e("GestureRecognizer", "Error with microphone: ${e.message}")
                Toast.makeText(this, "Microphone error. Please try again.", Toast.LENGTH_SHORT).show()
            }
        }
        
        // Set up return to gesture button
        findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.setOnClickListener {
            try {
                cleanupSpeechMode()
                Toast.makeText(this, "Returned to gesture recognition mode", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                android.util.Log.e("GestureRecognizer", "Error returning to gesture mode: ${e.message}")
            }
        }
        
        // Initially hide return to gesture button
        findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.visibility = android.view.View.GONE
        } catch (e: Exception) {
            android.util.Log.e("GestureRecognizer", "Error in onCreate: ${e.message}")
            Toast.makeText(this, "Failed to initialize camera", Toast.LENGTH_SHORT).show()
            finish()
        }
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
    
    private fun cleanupSpeechMode() {
        try {
            // Stop listening if active
            sttHelper?.stopListening()
            // Resume gesture recognition
            gestureRecognizerView?.resumeGestureRecognition()
            // Reset state
            isInSpeechMode = false
            // Hide return to gesture button
            findViewById<FloatingActionButton>(R.id.returnToGestureBtn)?.visibility = android.view.View.GONE
            // Reset mic button icon
            findViewById<FloatingActionButton>(R.id.micBtn)?.setImageResource(android.R.drawable.ic_btn_speak_now)
        } catch (e: Exception) {
            android.util.Log.e("GestureRecognizer", "Error in cleanupSpeechMode: ${e.message}")
            // Ensure state is reset even if errors occur
            isInSpeechMode = false
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
    
    
    override fun onPause() {
        super.onPause()
        try {
            // Stop listening when app goes to background
            if (isInSpeechMode && sttHelper?.isCurrentlyListening() == true) {
                sttHelper?.stopListening()
            }
        } catch (e: Exception) {
            android.util.Log.e("GestureRecognizer", "Error in onPause: ${e.message}")
        }
    }
    
    override fun onStop() {
        super.onStop()
        try {
            // Clean up speech mode when activity is no longer visible
            if (isInSpeechMode) {
                cleanupSpeechMode()
            }
        } catch (e: Exception) {
            android.util.Log.e("GestureRecognizer", "Error in onStop: ${e.message}")
        }
    }
    
    override fun onBackPressed() {
        try {
            // Clean up before going back
            if (isInSpeechMode) {
                cleanupSpeechMode()
            }
            super.onBackPressed()
        } catch (e: Exception) {
            android.util.Log.e("GestureRecognizer", "Error in onBackPressed: ${e.message}")
            super.onBackPressed()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        try {
            cleanupSpeechMode()
            sttHelper?.cleanup()
            sttHelper = null
            gestureRecognizerView = null
        } catch (e: Exception) {
            android.util.Log.e("GestureRecognizer", "Error in onDestroy: ${e.message}")
        }
    }
}
