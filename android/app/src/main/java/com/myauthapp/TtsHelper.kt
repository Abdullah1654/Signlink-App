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
        if (isInitialized && tts != null) {
            // Stop any ongoing speech
            tts?.stop()
            // Speak the text
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
            Log.d("TtsHelper", "Speaking: $text")
        } else {
            Log.w("TtsHelper", "TTS not initialized yet")
        }
    }

    fun stop() {
        tts?.stop()
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isInitialized = false
    }
}
