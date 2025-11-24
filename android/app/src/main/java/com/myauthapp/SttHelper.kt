package com.myauthapp

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import java.util.*

class SttHelper(private val context: Context) : RecognitionListener {
    
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())
    var onResult: ((String) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onListeningStateChanged: ((Boolean) -> Unit)? = null
    
    init {
        // Initialize SpeechRecognizer on main thread
        mainHandler.post {
            if (SpeechRecognizer.isRecognitionAvailable(context)) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
                speechRecognizer?.setRecognitionListener(this)
            } else {
                Log.e("SttHelper", "Speech recognition not available on this device")
            }
        }
    }
    
    fun startListening() {
        mainHandler.post {
            if (speechRecognizer == null) {
                onError?.invoke("Speech recognition not available")
                return@post
            }
            
            if (isListening) {
                stopListening()
                return@post
            }
            
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak now...")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            
            try {
                speechRecognizer?.startListening(intent)
                isListening = true
                onListeningStateChanged?.invoke(true)
                Log.d("SttHelper", "Started listening for speech")
            } catch (e: Exception) {
                Log.e("SttHelper", "Error starting speech recognition: ${e.message}")
                onError?.invoke("Failed to start speech recognition")
            }
        }
    }
    
    fun stopListening() {
        mainHandler.post {
            try {
                if (isListening) {
                    speechRecognizer?.stopListening()
                    isListening = false
                    onListeningStateChanged?.invoke(false)
                    Log.d("SttHelper", "Stopped listening for speech")
                }
            } catch (e: Exception) {
                Log.e("SttHelper", "Error stopping speech recognition: ${e.message}")
                isListening = false
                onListeningStateChanged?.invoke(false)
            }
        }
    }
    
    fun isCurrentlyListening(): Boolean = isListening
    
    // RecognitionListener callbacks
    override fun onReadyForSpeech(params: Bundle?) {
        Log.d("SttHelper", "Ready for speech")
    }
    
    override fun onBeginningOfSpeech() {
        Log.d("SttHelper", "Beginning of speech detected")
    }
    
    override fun onRmsChanged(rmsdB: Float) {
        // Volume level changed - can be used for visual feedback
    }
    
    override fun onBufferReceived(buffer: ByteArray?) {
        // Audio buffer received
    }
    
    override fun onEndOfSpeech() {
        Log.d("SttHelper", "End of speech detected")
        isListening = false
        onListeningStateChanged?.invoke(false)
    }
    
    override fun onError(error: Int) {
        isListening = false
        onListeningStateChanged?.invoke(false)
        
        val errorMessage = when (error) {
            SpeechRecognizer.ERROR_AUDIO -> "Microphone issue. Please try again"
            SpeechRecognizer.ERROR_CLIENT -> "Please try again"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission needed"
            SpeechRecognizer.ERROR_NETWORK -> "Network issue. Please try again"
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Connection timeout. Please try again"
            SpeechRecognizer.ERROR_NO_MATCH -> "Couldn't hear you. Please speak again"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Please wait and try again"
            SpeechRecognizer.ERROR_SERVER -> "Service unavailable. Please try again"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Didn't catch that. Please speak again"
            else -> "Something went wrong. Please try again"
        }
        
        Log.e("SttHelper", "Speech recognition error: $errorMessage")
        onError?.invoke(errorMessage)
    }
    
    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        if (!matches.isNullOrEmpty()) {
            val spokenText = matches[0]
            Log.d("SttHelper", "Speech recognition result: $spokenText")
            onResult?.invoke(spokenText)
        } else {
            Log.w("SttHelper", "No speech recognition results")
            onError?.invoke("No speech detected")
        }
        isListening = false
        onListeningStateChanged?.invoke(false)
    }
    
    override fun onPartialResults(partialResults: Bundle?) {
        // Partial results - can be used for real-time feedback
    }
    
    override fun onEvent(eventType: Int, params: Bundle?) {
        // Additional events
    }
    
    fun cleanup() {
        mainHandler.post {
            try {
                stopListening()
                speechRecognizer?.destroy()
                speechRecognizer = null
                Log.d("SttHelper", "STT helper cleaned up")
            } catch (e: Exception) {
                Log.e("SttHelper", "Error during cleanup: ${e.message}")
                speechRecognizer = null
                isListening = false
            }
        }
    }
}
