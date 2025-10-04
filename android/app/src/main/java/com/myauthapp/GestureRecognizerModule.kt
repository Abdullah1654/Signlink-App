package com.myauthapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.Manifest
import android.util.Log
import android.os.Handler
import android.os.Looper
import org.webrtc.VideoTrack
import com.oney.WebRTCModule.WebRTCModule

class GestureRecognizerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var ttsHelper: TtsHelper? = null
    private var sttHelper: SttHelper? = null
    private var bridge: WebRTCGestureBridge? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    
    init {
        // Initialize TTS and STT helpers on main thread
        mainHandler.post {
            ttsHelper = TtsHelper(reactContext)
            sttHelper = SttHelper(reactContext)
            
            // Set up STT callbacks after initialization
            sttHelper?.onResult = { result ->
                sendEvent("onSpeechResult", result)
            }
            
            sttHelper?.onError = { error ->
                sendEvent("onSpeechError", error)
            }
            
            sttHelper?.onListeningStateChanged = { isListening ->
                val params = Arguments.createMap()
                params.putBoolean("isListening", isListening)
                sendEvent("onListeningStateChanged", params)
            }
        }
    }
    
    override fun getName(): String = "GestureRecognizerModule"

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) { /* No-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* No-op */ }

    @ReactMethod
    fun startLocalTrackProcessing(trackId: String) {
        Log.d("GestureRecognizerModule", "startLocalTrackProcessing called with trackId: $trackId")
        val webRTCModule = reactContext.getNativeModule(WebRTCModule::class.java)
        if (webRTCModule == null) {
            Log.e("GestureRecognizerModule", "WebRTCModule not found")
            return
        }
        Log.d("GestureRecognizerModule", "WebRTCModule found")
        
        val mediaTrack = try {
            webRTCModule.javaClass.getDeclaredMethod("getLocalTrack", String::class.java).apply { isAccessible = true }.invoke(webRTCModule, trackId)
        } catch (e: Exception) {
            Log.e("GestureRecognizerModule", "Error getting local track: ${e.message}")
            return
        }
        
        if (mediaTrack !is VideoTrack) {
            Log.e("GestureRecognizerModule", "Media track is not a VideoTrack: ${mediaTrack?.javaClass?.simpleName}")
            return
        }
        Log.d("GestureRecognizerModule", "VideoTrack found: ${mediaTrack.id()}")

        val helper = GestureRecognizerHelper(
            currentDelegate = GestureRecognizerHelper.DELEGATE_GPU,
            runningMode = com.google.mediapipe.tasks.vision.core.RunningMode.LIVE_STREAM,
            context = reactContext,
            gestureRecognizerListener = object : GestureRecognizerHelper.GestureRecognizerListener {
                override fun onError(error: String, errorCode: Int) {}
                override fun onResults(resultBundle: GestureRecognizerHelper.ResultBundle) {
                    Log.d("GestureRecognizerModule", "Gesture recognition results received")
                    val result = resultBundle.results.firstOrNull()
                    val category = result?.gestures()?.firstOrNull()?.firstOrNull()
                    if (category != null) {
                        Log.d("GestureRecognizerModule", "Gesture detected: ${category.categoryName()} (${category.score()})")
                        val map = Arguments.createMap()
                        map.putString("label", category.categoryName())
                        map.putDouble("score", category.score().toDouble())
                        map.putDouble("timestamp", result.timestampMs().toDouble())
                        // Landmarks for the first detected hand
                        val lmsArray = Arguments.createArray()
                        val handLandmarks = result.landmarks()?.firstOrNull()
                        if (handLandmarks != null) {
                            for (lm in handLandmarks) {
                                val pt = Arguments.createMap()
                                pt.putDouble("x", lm.x().toDouble())
                                pt.putDouble("y", lm.y().toDouble())
                                lmsArray.pushMap(pt)
                            }
                        }
                        map.putArray("landmarks", lmsArray)
                        map.putInt("imageWidth", resultBundle.inputImageWidth)
                        map.putInt("imageHeight", resultBundle.inputImageHeight)
                        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("GestureRecognition.onResult", map)
                    } else {
                        Log.d("GestureRecognizerModule", "No gesture detected in this frame")
                    }
                }
            }
        )
        bridge = WebRTCGestureBridge(reactContext, helper)
        bridge?.start(mediaTrack)
    }

    @ReactMethod
    fun stop() {
        bridge?.stop()
        bridge = null
    }

    @ReactMethod
    fun checkCameraPermission(promise: Promise) {
        val permission = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CAMERA)
        promise.resolve(permission == PackageManager.PERMISSION_GRANTED)
    }

    @ReactMethod
    fun toggleCamera(promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("E_NO_ACTIVITY", "No activity found")
            return
        }
        val view = activity.findViewById<GestureRecognizerView>(R.id.gesture_recognizer_view)
        if (view != null) {
            // Toggle is handled in GestureRecognizerView; just resolve
            promise.resolve(true)
        } else {
            promise.reject("E_NO_VIEW", "GestureRecognizerView not found")
        }
    }
    
    // TTS Methods
    @ReactMethod
    fun speak(text: String, promise: Promise) {
        try {
            ttsHelper?.speak(text)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("GestureRecognizerModule", "Error speaking text: ${e.message}")
            promise.reject("TTS_ERROR", "Failed to speak text: ${e.message}")
        }
    }
    
    @ReactMethod
    fun stopSpeaking(promise: Promise) {
        try {
            ttsHelper?.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("GestureRecognizerModule", "Error stopping speech: ${e.message}")
            promise.reject("TTS_ERROR", "Failed to stop speech: ${e.message}")
        }
    }
    
    // STT Methods
    @ReactMethod
    fun startListening(promise: Promise) {
        try {
            sttHelper?.startListening()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("GestureRecognizerModule", "Error starting speech recognition: ${e.message}")
            promise.reject("STT_ERROR", "Failed to start speech recognition: ${e.message}")
        }
    }
    
    @ReactMethod
    fun stopListening(promise: Promise) {
        try {
            sttHelper?.stopListening()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("GestureRecognizerModule", "Error stopping speech recognition: ${e.message}")
            promise.reject("STT_ERROR", "Failed to stop speech recognition: ${e.message}")
        }
    }
    
    @ReactMethod
    fun isListening(promise: Promise) {
        try {
            val isListening = sttHelper?.isCurrentlyListening() ?: false
            promise.resolve(isListening)
        } catch (e: Exception) {
            Log.e("GestureRecognizerModule", "Error checking listening state: ${e.message}")
            promise.reject("STT_ERROR", "Failed to check listening state: ${e.message}")
        }
    }
    
    // Helper method to send events to React Native
    private fun sendEvent(eventName: String, data: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }
    
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        // Cleanup resources on main thread
        mainHandler.post {
            ttsHelper?.shutdown()
            sttHelper?.cleanup()
        }
    }
}
