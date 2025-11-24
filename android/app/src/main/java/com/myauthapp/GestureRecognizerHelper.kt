package com.myauthapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import androidx.camera.core.ImageProxy
import androidx.camera.core.CameraSelector
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizer
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizerResult

class GestureRecognizerHelper(
    var minHandDetectionConfidence: Float = DEFAULT_HAND_DETECTION_CONFIDENCE,
    var minHandTrackingConfidence: Float = DEFAULT_HAND_TRACKING_CONFIDENCE,
    var minHandPresenceConfidence: Float = DEFAULT_HAND_PRESENCE_CONFIDENCE,
    var maxNumHands: Int = DEFAULT_NUM_HANDS,
    val currentDelegate: Int = DELEGATE_CPU, // Locked to CPU only
    var runningMode: RunningMode = RunningMode.IMAGE,
    val context: Context,
    val gestureRecognizerListener: GestureRecognizerListener? = null
) {
    private var gestureRecognizer: GestureRecognizer? = null

    init {
        setupGestureRecognizer()
    }

    fun clearGestureRecognizer() {
        try {
            gestureRecognizer?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing gesture recognizer: ${e.message}")
        } finally {
            gestureRecognizer = null
        }
    }

    fun setupGestureRecognizer() {
        // Always use CPU delegate
        val baseOptionBuilder = BaseOptions.builder().setDelegate(Delegate.CPU)
        baseOptionBuilder.setModelAssetPath(MP_RECOGNIZER_TASK)
        when (runningMode) {
            RunningMode.LIVE_STREAM -> {
                if (gestureRecognizerListener == null) {
                    throw IllegalStateException("gestureRecognizerListener must be set when runningMode is LIVE_STREAM.")
                }
            }
            else -> { /* no-op */ }
        }
        try {
            val baseOptions = baseOptionBuilder.build()
            val optionsBuilder = GestureRecognizer.GestureRecognizerOptions.builder()
                .setBaseOptions(baseOptions)
                .setMinHandDetectionConfidence(minHandDetectionConfidence)
                .setMinTrackingConfidence(minHandTrackingConfidence)
                .setMinHandPresenceConfidence(minHandPresenceConfidence)
                .setNumHands(maxNumHands)
                .setRunningMode(runningMode)
            if (runningMode == RunningMode.LIVE_STREAM) {
                optionsBuilder
                    .setResultListener(this::returnLivestreamResult)
                    .setErrorListener(this::returnLivestreamError)
            }
            val options = optionsBuilder.build()
            gestureRecognizer = GestureRecognizer.createFromOptions(context, options)
        } catch (e: IllegalStateException) {
            gestureRecognizerListener?.onError("Gesture recognizer failed to initialize. See error logs for details")
            Log.e(TAG, "MP Task Vision failed to load the task with error: ${e.message}")
        } catch (e: RuntimeException) {
            gestureRecognizerListener?.onError("Gesture recognizer failed to initialize. See error logs for details", GPU_ERROR)
            Log.e(TAG, "MP Task Vision failed to load the task with error: ${e.message}")
        }
    }

    fun recognizeLiveStream(imageProxy: ImageProxy, cameraFacing: Int) {
        try {
            if (gestureRecognizer == null) {
                Log.w(TAG, "Gesture recognizer not initialized")
                imageProxy.close()
                return
            }
            
            val frameTime = SystemClock.uptimeMillis()
            val bitmapBuffer = Bitmap.createBitmap(
                imageProxy.width, imageProxy.height, Bitmap.Config.ARGB_8888
            )
            imageProxy.use { bitmapBuffer.copyPixelsFromBuffer(imageProxy.planes[0].buffer) }
            imageProxy.close()
            
            val matrix = Matrix().apply {
                postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
                if (cameraFacing == CameraSelector.LENS_FACING_FRONT) {
                    postScale(-1f, 1f, imageProxy.width.toFloat(), imageProxy.height.toFloat())
                }
            }
            
            val rotatedBitmap = Bitmap.createBitmap(
                bitmapBuffer, 0, 0, bitmapBuffer.width, bitmapBuffer.height, matrix, true
            )
            val mpImage = BitmapImageBuilder(rotatedBitmap).build()
            recognizeAsync(mpImage, frameTime)
        } catch (e: Exception) {
            Log.e(TAG, "Error in recognizeLiveStream: ${e.message}")
            try {
                imageProxy.close()
            } catch (closeError: Exception) {
                Log.e(TAG, "Error closing image proxy: ${closeError.message}")
            }
        }
    }

    fun recognizeAsync(mpImage: MPImage, frameTime: Long) {
        try {
            gestureRecognizer?.recognizeAsync(mpImage, frameTime)
                ?: Log.w(TAG, "Cannot recognize: gesture recognizer is null")
        } catch (e: Exception) {
            Log.e(TAG, "Error in recognizeAsync: ${e.message}")
        }
    }

    fun isClosed(): Boolean = gestureRecognizer == null

    private fun returnLivestreamResult(result: GestureRecognizerResult, input: MPImage) {
        try {
            val finishTimeMs = SystemClock.uptimeMillis()
            val inferenceTime = finishTimeMs - result.timestampMs()
            gestureRecognizerListener?.onResults(ResultBundle(listOf(result), inferenceTime, input.height, input.width))
        } catch (e: Exception) {
            Log.e(TAG, "Error processing livestream result: ${e.message}")
            gestureRecognizerListener?.onError("Error processing gesture results", OTHER_ERROR)
        }
    }

    private fun returnLivestreamError(error: RuntimeException) {
        gestureRecognizerListener?.onError(error.message ?: "An unknown error has occurred")
    }

    companion object {
        val TAG = "GestureRecognizerHelper ${this.hashCode()}"
        private const val MP_RECOGNIZER_TASK = "gesture_recognizer.task"
        const val DELEGATE_CPU = 0
        const val DELEGATE_GPU = 1
        const val DEFAULT_HAND_DETECTION_CONFIDENCE = 0.7F
        const val DEFAULT_HAND_TRACKING_CONFIDENCE = 0.7F
        const val DEFAULT_HAND_PRESENCE_CONFIDENCE = 0.7F
        const val DEFAULT_NUM_HANDS = 2
        const val OTHER_ERROR = 0
        const val GPU_ERROR = 1
    }

    data class ResultBundle(
        val results: List<GestureRecognizerResult>,
        val inferenceTime: Long,
        val inputImageHeight: Int,
        val inputImageWidth: Int,
    )

    interface GestureRecognizerListener {
        fun onError(error: String, errorCode: Int = OTHER_ERROR)
        fun onResults(resultBundle: ResultBundle)
    }
}
