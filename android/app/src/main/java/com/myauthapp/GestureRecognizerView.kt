package com.myauthapp

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.util.AttributeSet
import android.util.Log
import android.view.LayoutInflater
import android.widget.Toast
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.myauthapp.databinding.FragmentCameraBinding
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class GestureRecognizerView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : androidx.appcompat.widget.LinearLayoutCompat(context, attrs, defStyleAttr), GestureRecognizerHelper.GestureRecognizerListener {
    private var binding: FragmentCameraBinding? = null
    private var gestureRecognizerHelper: GestureRecognizerHelper? = null
    private var gestureRecognizerResultAdapter: GestureRecognizerResultsAdapter? = null
    private var preview: Preview? = null
    private var imageAnalyzer: ImageAnalysis? = null
    private var camera: Camera? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var cameraFacing = CameraSelector.LENS_FACING_FRONT
    private val backgroundExecutor: ExecutorService = Executors.newFixedThreadPool(2)
    private var isGestureRecognitionPaused = false

    init {
        initView()
    }

    private fun initView() {
        binding = FragmentCameraBinding.inflate(LayoutInflater.from(context), this, true)
        gestureRecognizerResultAdapter = GestureRecognizerResultsAdapter(context).apply {
            onSentenceUpdate = { sentence ->
                sendEvent("onSentenceUpdate", Arguments.createMap().apply {
                    putString("sentence", sentence)
                })
            }
        }
        binding?.recyclerviewResults?.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = gestureRecognizerResultAdapter
        }
        binding?.toggleCameraButton?.setOnClickListener {
            cameraFacing = if (cameraFacing == CameraSelector.LENS_FACING_FRONT) {
                CameraSelector.LENS_FACING_BACK
            } else {
                CameraSelector.LENS_FACING_FRONT
            }
            backgroundExecutor.execute { setUpCamera() }
        }
        
        // Hide the bottom sheet completely
        binding?.bottomSheetLayout?.root?.visibility = android.view.View.GONE
        
        backgroundExecutor.execute {
            // Always use CPU delegate
            gestureRecognizerHelper = GestureRecognizerHelper(
                context = context,
                runningMode = RunningMode.LIVE_STREAM,
                minHandDetectionConfidence = DEFAULT_CONFIDENCE,
                minHandTrackingConfidence = DEFAULT_CONFIDENCE,
                minHandPresenceConfidence = DEFAULT_CONFIDENCE,
                maxNumHands = 2,
                currentDelegate = GestureRecognizerHelper.DELEGATE_CPU,
                gestureRecognizerListener = this
            )
        }
        post { setUpCamera() }
    }





    @SuppressLint("MissingPermission")
    private fun setUpCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                bindCameraUseCases()
            } catch (e: Exception) {
                Log.e(TAG, "Camera initialization failed: ${e.message}")
                showToast("Camera initialization failed: ${e.message}")
            }
        }, ContextCompat.getMainExecutor(context))
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun bindCameraUseCases() {
        try {
            val cameraProvider = cameraProvider ?: throw IllegalStateException("Camera initialization failed.")
            val cameraSelector = CameraSelector.Builder().requireLensFacing(cameraFacing).build()
            preview = Preview.Builder().setTargetAspectRatio(AspectRatio.RATIO_4_3)
                .setTargetRotation(binding?.viewFinder?.display?.rotation ?: 0)
                .build()
            imageAnalyzer = ImageAnalysis.Builder().setTargetAspectRatio(AspectRatio.RATIO_4_3)
                .setTargetRotation(binding?.viewFinder?.display?.rotation ?: 0)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .build().also {
                    it.setAnalyzer(backgroundExecutor) { image -> recognizeHand(image) }
                }
            cameraProvider.unbindAll()
            camera = cameraProvider.bindToLifecycle(context as androidx.activity.ComponentActivity, cameraSelector, preview, imageAnalyzer)
            binding?.viewFinder?.surfaceProvider?.let { preview?.setSurfaceProvider(it) }
        } catch (exc: Exception) {
            Log.e(TAG, "Camera binding failed: ${exc.message}")
            showToast("Camera binding failed: ${exc.message}")
        }
    }

    private fun recognizeHand(imageProxy: ImageProxy) {
        try {
            if (!isGestureRecognitionPaused) {
                gestureRecognizerHelper?.recognizeLiveStream(imageProxy, cameraFacing)
                    ?: imageProxy.close()
            } else {
                imageProxy.close()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in recognizeHand: ${e.message}")
            imageProxy.close()
        }
    }
    
    fun pauseGestureRecognition() {
        isGestureRecognitionPaused = true
        Log.d(TAG, "Gesture recognition paused")
    }
    
    fun resumeGestureRecognition() {
        isGestureRecognitionPaused = false
        Log.d(TAG, "Gesture recognition resumed")
    }
    
    fun addSpokenSentence(text: String) {
        try {
            if (text.isNotBlank()) {
                gestureRecognizerResultAdapter?.addSpokenSentence(text.trim())
            } else {
                Log.w(TAG, "Attempted to add empty spoken sentence")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error adding spoken sentence: ${e.message}")
        }
    }
    
    fun toggleCamera() {
        try {
            cameraFacing = if (cameraFacing == CameraSelector.LENS_FACING_FRONT) {
                CameraSelector.LENS_FACING_BACK
            } else {
                CameraSelector.LENS_FACING_FRONT
            }
            if (!backgroundExecutor.isShutdown) {
                backgroundExecutor.execute { setUpCamera() }
            } else {
                Log.e(TAG, "Cannot toggle camera: executor is shutdown")
                showToast("Camera unavailable")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error toggling camera: ${e.message}")
            showToast("Failed to switch camera")
        }
    }

    override fun onResults(resultBundle: GestureRecognizerHelper.ResultBundle) {
        try {
            post {
                binding?.let { b ->
                    try {
                        if (resultBundle.results.isNotEmpty()) {
                            gestureRecognizerResultAdapter?.updateResults(resultBundle.results.first().gestures())
                            val gesture = gestureRecognizerResultAdapter?.getTopGestureName() ?: "No Hands Detected"
                            
                            // Update fixed gesture status line
                            b.tvCurrentGesture?.text = gesture
                            
                            // Removed inference time display
                            b.overlay.setResults(resultBundle.results.first(), resultBundle.inputImageHeight, resultBundle.inputImageWidth, RunningMode.LIVE_STREAM)
                            b.viewFinder.setBackgroundColor(
                                if (gesture != "No Hands Detected" && gesture != "None") Color.GREEN else Color.TRANSPARENT
                            )
                            b.overlay.invalidate()
                            sendEvent("onGestureDetected", Arguments.createMap().apply {
                                putString("gesture", gesture)
                                putDouble("inferenceTime", resultBundle.inferenceTime.toDouble())
                            })
                        } else {
                            Log.w(TAG, "Received empty results bundle")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error processing results: ${e.message}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in onResults: ${e.message}")
        }
    }

    override fun onError(error: String, errorCode: Int) {
        post {
            showToast(error)
            gestureRecognizerResultAdapter?.updateResults(null)
            binding?.tvCurrentGesture?.text = "No Hands Detected"
            binding?.viewFinder?.setBackgroundColor(Color.TRANSPARENT)
            // Removed GPU error handling since we only use CPU
        }
    }

    private fun showToast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            (context as? ReactContext)?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event $eventName: ${e.message}")
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        try {
            gestureRecognizerHelper?.clearGestureRecognizer()
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing gesture recognizer: ${e.message}")
        }
        
        try {
            if (!backgroundExecutor.isShutdown) {
                backgroundExecutor.shutdown()
                if (!backgroundExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                    backgroundExecutor.shutdownNow()
                    Log.w(TAG, "Executor did not terminate gracefully")
                }
            }
        } catch (e: InterruptedException) {
            Log.e(TAG, "Error shutting down executor: ${e.message}")
            backgroundExecutor.shutdownNow()
            Thread.currentThread().interrupt()
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error during cleanup: ${e.message}")
        }
        
        binding = null
    }

    companion object {
        private const val TAG = "GestureRecognizerView"
        private const val DEFAULT_CONFIDENCE = 0.7f
    }
}
