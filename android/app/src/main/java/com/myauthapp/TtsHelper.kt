package com.myauthapp

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.*

class TtsHelper(private val context: Context) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var isInitialized = false

    init {
        tts = TextToSpeech(context, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale.US)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.e("TtsHelper", "Language not supported")
            } else {
                isInitialized = true
                Log.d("TtsHelper", "TTS initialized successfully")
            }
        } else {
            Log.e("TtsHelper", "TTS initialization failed")
        }
    }

    fun speak(text: String) {
        try {
            if (text.isBlank()) {
                Log.w("TtsHelper", "Cannot speak empty text")
                return
            }
            
            if (isInitialized && tts != null) {
                // Stop any ongoing speech
                tts?.stop()
                // Speak the text
                val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
                if (result == TextToSpeech.ERROR) {
                    Log.e("TtsHelper", "Error speaking text")
                } else {
                    Log.d("TtsHelper", "Speaking: $text")
                }
            } else {
                Log.w("TtsHelper", "TTS not initialized yet")
            }
        } catch (e: Exception) {
            Log.e("TtsHelper", "Error in speak method: ${e.message}")
        }
    }

    fun stop() {
        tts?.stop()
    }

    fun shutdown() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {
            Log.e("TtsHelper", "Error during shutdown: ${e.message}")
        } finally {
            tts = null
            isInitialized = false
            Log.d("TtsHelper", "TTS shutdown complete")
        }
    }
}
