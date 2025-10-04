package com.myauthapp

import android.content.Context
import android.graphics.Bitmap
import android.os.SystemClock
import org.webrtc.*
import org.webrtc.YuvHelper
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage

class WebRTCGestureBridge(
    private val context: Context,
    private val helper: GestureRecognizerHelper
) : VideoSink {

    private var videoTrack: VideoTrack? = null
    private val yuvConverter = YuvConverter()

    fun start(track: VideoTrack) {
        android.util.Log.d("WebRTCGestureBridge", "Starting gesture bridge for track: ${track.id()}")
        stop()
        videoTrack = track
        track.addSink(this)
        android.util.Log.d("WebRTCGestureBridge", "VideoSink added to track")
    }

    fun stop() {
        videoTrack?.removeSink(this)
        videoTrack = null
    }

    private var frameSkipCounter = 0

    override fun onFrame(frame: VideoFrame) {
        // Throttle processing to every 2nd frame to reduce CPU load
        frameSkipCounter = (frameSkipCounter + 1) % 2
        if (frameSkipCounter != 0) return
        
        android.util.Log.d("WebRTCGestureBridge", "Processing frame ${frame.rotation}°")
        val ts = SystemClock.uptimeMillis()
        val buffer = frame.buffer
        val i420 = buffer.toI420() as VideoFrame.I420Buffer
        try {
            val width = i420.width
            val height = i420.height
            val yBuf = i420.dataY
            val uBuf = i420.dataU
            val vBuf = i420.dataV
            val yStride = i420.strideY
            val uStride = i420.strideU
            val vStride = i420.strideV

            val pixels = IntArray(width * height)

            // Convert I420 (YUV420 planar) to ARGB8888 (slow but works for demo)
            for (y in 0 until height) {
                for (x in 0 until width) {
                    val yIndex = y * yStride + x
                    val uvRow = (y / 2)
                    val uvCol = (x / 2)
                    val uIndex = uvRow * uStride + uvCol
                    val vIndex = uvRow * vStride + uvCol

                    val Y = (yBuf.get(yIndex).toInt() and 0xFF) - 16
                    val U = (uBuf.get(uIndex).toInt() and 0xFF) - 128
                    val V = (vBuf.get(vIndex).toInt() and 0xFF) - 128

                    val yClamped = if (Y < 0) 0 else Y
                    val rTmp = (1192 * yClamped + 1634 * V) shr 10
                    val gTmp = (1192 * yClamped - 833 * V - 400 * U) shr 10
                    val bTmp = (1192 * yClamped + 2066 * U) shr 10

                    val r = if (rTmp < 0) 0 else if (rTmp > 255) 255 else rTmp
                    val g = if (gTmp < 0) 0 else if (gTmp > 255) 255 else gTmp
                    val b = if (bTmp < 0) 0 else if (bTmp > 255) 255 else bTmp

                    pixels[y * width + x] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
                }
            }

            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bmp.setPixels(pixels, 0, width, 0, 0, width, height)
            // Apply rotation from WebRTC frame then mirror for front camera
            val rotateMatrix = android.graphics.Matrix().apply { postRotate(frame.rotation.toFloat()) }
            val rotated = Bitmap.createBitmap(bmp, 0, 0, width, height, rotateMatrix, true)
            val cx = rotated.width / 2f
            val cy = rotated.height / 2f
            val mirrorMatrix = android.graphics.Matrix().apply { setScale(-1f, 1f, cx, cy) }
            val finalBmp = Bitmap.createBitmap(rotated, 0, 0, rotated.width, rotated.height, mirrorMatrix, false)
            val mpImage: MPImage = BitmapImageBuilder(finalBmp).build()
            helper.recognizeAsync(mpImage, ts)
        } finally {
            i420.release()
        }
    }

    // Rotation handling can be added if needed; MediaPipe can handle orientation internally
}
