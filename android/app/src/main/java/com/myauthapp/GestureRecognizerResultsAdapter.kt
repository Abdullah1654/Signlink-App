package com.myauthapp

import android.annotation.SuppressLint
import android.content.Context
import android.os.SystemClock
import android.util.Log
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.google.mediapipe.tasks.components.containers.Category
import java.util.Locale
import com.myauthapp.databinding.ItemGestureRecognizerResultBinding

class GestureRecognizerResultsAdapter(private val context: Context) : RecyclerView.Adapter<GestureRecognizerResultsAdapter.ViewHolder>() {
    // Gemini API key (keep this secure in production)
    private val GEMINI_API_KEY = "AIzaSyAYQWM3Sjvip1h2VcViEj_qsn6-hQp0zHg"
    // Default model the user prefers
    private val GEMINI_MODEL_PRIMARY = "gemini-2.0-flash"
    // Fallback for broader availability
    private val GEMINI_MODEL_FALLBACK = "gemini-2.5-flash-lite"

    private fun modelEndpoint(model: String): String {
        // gemini-2.0 and 2.5 models typically on v1beta at time of writing
        val base = if (model.startsWith("gemini-2.")) "https://generativelanguage.googleapis.com/v1beta/models/" else "https://generativelanguage.googleapis.com/v1/models/"
        return base + model + ":generateContent?key=" + GEMINI_API_KEY
    }

    // Prevent duplicate finalization and duplicate API calls
    private var isFinalizing = false
    private var inFlightGemini = false
    private var pendingGeminiIndex: Int? = null

    // Function to call Gemini API and get a meaningful sentence
    private fun getMeaningfulSentence(rawSentence: String, callback: (String) -> Unit) {
        Thread {
            try {
                val prompt = "You are turning raw gesture words into an easy-to-read sentence. Keep it concise and grammatical. Raw: $rawSentence"
                // Build JSON using org.json to avoid escaping issues (which can cause HTTP 400)
                val part = org.json.JSONObject().put("text", prompt)
                val content = org.json.JSONObject()
                    .put("role", "user")
                    .put("parts", org.json.JSONArray().put(part))
                val genConfig = org.json.JSONObject()
                    .put("temperature", 0.7)
                    .put("topK", 40)
                    .put("topP", 0.95)
                    .put("maxOutputTokens", 64)
                val body = org.json.JSONObject()
                    .put("contents", org.json.JSONArray().put(content))
                    .put("generationConfig", genConfig)

                fun callOnce(model: String): Pair<Int, String> {
                    val url = java.net.URL(modelEndpoint(model))
                    val conn = url.openConnection() as java.net.HttpURLConnection
                    conn.connectTimeout = 10000
                    conn.readTimeout = 15000
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    conn.doOutput = true
                    conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                    val status = conn.responseCode
                    val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                    val response = stream?.bufferedReader()?.readText() ?: ""
                    return status to response
                }

                // Try primary then fallback on 400/404
                var (status, response) = callOnce(GEMINI_MODEL_PRIMARY)
                if (status == 400 || status == 404) {
                    Log.w(TAG, "Primary model $GEMINI_MODEL_PRIMARY returned $status; trying fallback $GEMINI_MODEL_FALLBACK")
                    val res2 = callOnce(GEMINI_MODEL_FALLBACK)
                    status = res2.first
                    response = res2.second
                }

                if (status !in 200..299) {
                    Log.e(TAG, "Gemini HTTP $status: $response")
                    // Try to parse error message
                    val errMsg = try {
                        val eroot = org.json.JSONObject(response)
                        eroot.optJSONObject("error")?.optString("message")
                    } catch (e: Exception) { null }
                    callback("[Gemini HTTP $status${if (!errMsg.isNullOrBlank()) ": $errMsg" else ""}]")
                    return@Thread
                }

                // Parse: candidates[0].content.parts[0].text
                val text = try {
                    val root = org.json.JSONObject(response)
                    val candidates = root.optJSONArray("candidates")
                    val first = candidates?.optJSONObject(0)
                    val contentObj = first?.optJSONObject("content")
                    val parts = contentObj?.optJSONArray("parts")
                    parts?.optJSONObject(0)?.optString("text")?.replace("\n", " ")?.trim()
                } catch (pe: Exception) {
                    null
                }
                callback(text?.ifBlank { null } ?: "[No content from Gemini]")
            } catch (e: Exception) {
                Log.e(TAG, "Gemini API error", e)
                callback("[Gemini error]")
            }
        }.start()
    }
    companion object {
        private const val TAG = "GestureAdapter"
        private const val NO_VALUE = "--"
        private const val NO_HANDS = "No Hands Detected"
        private const val NONE_GESTURE = "None"
        private const val MIN_CONFIDENCE = 0.6f
        private const val HISTORY_SIZE = 5
        private const val GESTURE_STABILITY_MS = 200L
        private const val GESTURE_COOLDOWN_MS = 500L
        private const val NO_HANDS_TIMEOUT_MS = 1500L
        private const val MAX_DISPLAYED_SENTENCES = 3
    }

    private var adapterCategories: MutableList<Category?> = mutableListOf(null)
    private var currentGesture: String = "No Hands Detected"
    private var currentScore: Float = 0f
    private val gestureHistory = mutableListOf<String>()
    private val sentenceGestures = mutableListOf<String>()
    private val sentences = mutableListOf<String>()
    private var isBuildingSentence = false
    private var lastGestureAddedTime = 0L
    private var noHandsStartTime: Long? = null
    private var ttsHelper: TtsHelper? = null
    var onSentenceUpdate: ((String) -> Unit)? = null
    // Allow single-word sentences to pass
    private val MIN_SENTENCE_ALPHA_CHARS = 1
    
    init {
        ttsHelper = TtsHelper(context)
    }

    private fun cleanGestureName(gesture: String?): String {
        if (gesture == null || gesture == NO_HANDS || gesture == NONE_GESTURE) return gesture.toString()
        return gesture.replace("TwoHand_", "").replace("_", " ")
    }

    @SuppressLint("NotifyDataSetChanged")
    fun updateResults(categories: List<List<Category>>?) {
        var gesture: String? = null
        var score: Float? = null
        val currentTime = SystemClock.uptimeMillis()

        if (categories.isNullOrEmpty() || categories.all { it.isEmpty() }) {
            gesture = NO_HANDS
            score = 0f
        } else {
            val flattenedCategories = categories.flatten().filter { it.score() >= MIN_CONFIDENCE }.sortedByDescending { it.score() }
            if (flattenedCategories.isEmpty()) {
                gesture = NO_HANDS
                score = 0f
            } else {
                // Simply take the top gesture, whether it's from one hand or two hands
                val topCategory = flattenedCategories.firstOrNull()
                gesture = cleanGestureName(topCategory?.categoryName())
                score = topCategory?.score()
            }
        }

        gestureHistory.add(gesture ?: NO_HANDS)
        if (gestureHistory.size > HISTORY_SIZE) gestureHistory.removeAt(0)
        val smoothedGesture = gestureHistory.groupingBy { it }.eachCount().maxByOrNull { it.value }?.key ?: NO_HANDS
        Log.d(TAG, "Detected gesture: $smoothedGesture, Score: $score, History: $gestureHistory")

        // Store current gesture for external access (used by View)
        currentGesture = smoothedGesture
        currentScore = score ?: 0f

        if (smoothedGesture == NO_HANDS) {
            if (noHandsStartTime == null && isBuildingSentence && sentenceGestures.isNotEmpty()) {
                noHandsStartTime = currentTime
                Log.d(TAG, "Started No Hands Detected timer at $noHandsStartTime")
            }
            if (!isFinalizing && noHandsStartTime != null && currentTime - noHandsStartTime!! >= NO_HANDS_TIMEOUT_MS && isBuildingSentence && sentenceGestures.isNotEmpty()) {
                isFinalizing = true
                val newSentence = getFormattedSentence()
                if (isTrivialSentence(newSentence)) {
                    // Nothing to finalize; reset flags and bail out
                    isFinalizing = false
                    sentenceGestures.clear()
                    isBuildingSentence = false
                    noHandsStartTime = null
                    return
                }
                // Show raw sentence immediately
                sentences.add(newSentence)
                pendingGeminiIndex = sentences.lastIndex
                Log.d(TAG, "Finalized raw sentence: $newSentence, All sentences: $sentences")
                notifyDataSetChanged()

                // Reset builders before network call to avoid duplicates
                sentenceGestures.clear()
                isBuildingSentence = false
                noHandsStartTime = null

                // If the finalized sentence is a single dot, do not call Gemini (as requested)
                if (newSentence.trim() == ".") {
                    Log.d(TAG, "Skipping Gemini call for single dot sentence")
                    isFinalizing = false
                    pendingGeminiIndex = null
                } else if (!inFlightGemini) {
                    inFlightGemini = true
                    getMeaningfulSentence(newSentence) { geminiSentence ->
                        (context as? android.app.Activity)?.runOnUiThread {
                            // If model replied with a prompt request, keep raw sentence instead
                            val cleanedGemini = if (isTrivialSentence(geminiSentence) || isPromptLike(geminiSentence)) newSentence else geminiSentence
                            pendingGeminiIndex?.let { idx ->
                                if (idx in sentences.indices) {
                                    sentences[idx] = cleanedGemini
                                } else {
                                    sentences.add(cleanedGemini)
                                }
                            } ?: run {
                                sentences.add(cleanedGemini)
                            }
                            Log.d(TAG, "[Gemini] Rewritten: $cleanedGemini, All sentences: $sentences")
                            onSentenceUpdate?.invoke(cleanedGemini)
                            notifyDataSetChanged()
                            inFlightGemini = false
                            isFinalizing = false
                            pendingGeminiIndex = null
                        }
                    }
                }
            }
        } else {
            noHandsStartTime = null
            Log.d(TAG, "Reset No Hands timer due to gesture: $smoothedGesture")
            if (smoothedGesture != NONE_GESTURE) {
                if (!isBuildingSentence) {
                    isBuildingSentence = true
                    sentenceGestures.clear()
                    Log.d(TAG, "Started building sentence")
                }
                val gestureCount = gestureHistory.count { it == smoothedGesture }
                Log.d(TAG, "Checking gesture stability: $smoothedGesture, Count: $gestureCount, Time since last added: ${currentTime - lastGestureAddedTime}")
                if (gestureCount >= 1 && currentTime - lastGestureAddedTime >= GESTURE_COOLDOWN_MS && (sentenceGestures.isEmpty() || sentenceGestures.last() != smoothedGesture)) {
                    sentenceGestures.add(smoothedGesture)
                    lastGestureAddedTime = currentTime
                    Log.d(TAG, "Added gesture to sentence: $smoothedGesture, Sentence so far: $sentenceGestures")
                }
            }
        }
    }

    fun getFormattedSentence(): String {
        if (sentenceGestures.isEmpty()) return ""
        val raw = sentenceGestures.joinToString(", ") { it.lowercase(Locale.US).trim() }
        // If raw collapses to empty (no alphanumerics), treat as empty
        val alphaCount = raw.count { it.isLetter() }
        if (raw.isBlank() || alphaCount < MIN_SENTENCE_ALPHA_CHARS) return ""
        // Normalize whitespace: collapse newlines and multiple spaces
        val normalized = raw
            .replace(Regex("\\n+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .trim(',')
        if (normalized.isBlank()) return ""
        return normalized.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() } + "."
    }

    fun getTopGestureName(): String = currentGesture
    
    @SuppressLint("NotifyDataSetChanged")
    fun addSpokenSentence(text: String) {
        if (text.isNotEmpty() && !isTrivialSentence(text)) {
            sentences.add(text)
            Log.d(TAG, "Added spoken sentence: $text, All sentences: $sentences")
            notifyDataSetChanged()
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemGestureRecognizerResultBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        // Only show sentences in RecyclerView now
        val sentence = sentences.getOrNull(position)
        holder.bind(sentence, position + 1)
    }

    override fun getItemCount(): Int = sentences.size

    inner class ViewHolder(private val binding: ItemGestureRecognizerResultBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(sentence: String?, sentenceIndex: Int) {
            with(binding) {
                tvLabel.text = if (sentence != null) "${sentenceIndex}. $sentence" else NO_VALUE
                tvScore.visibility = android.view.View.GONE // No scores for sentences
                tvLabel.setTextColor(0xFF000000.toInt())
                tvLabel.setTypeface(null, android.graphics.Typeface.BOLD)
                tvLabel.textSize = 18f
                
                // Show TTS button for valid sentences
                btnTts.visibility = if (sentence != null && sentence.isNotEmpty()) 
                    android.view.View.VISIBLE else android.view.View.GONE
                
                // Set up TTS button click listener
                btnTts.setOnClickListener {
                    sentence?.let { text ->
                        ttsHelper?.speak(text)
                    }
                }
            }
        }
    }

    // Helpers
    private fun isTrivialSentence(s: String?): Boolean {
        if (s == null) return true
        val trimmed = s.trim().trim('.')
        if (trimmed.isBlank()) return true
        val alpha = trimmed.count { it.isLetter() }
        return alpha < MIN_SENTENCE_ALPHA_CHARS
    }

    private fun isPromptLike(s: String?): Boolean {
        if (s == null) return false
        val t = s.lowercase(Locale.US)
        // Heuristics: model asking for more input
        return (t.contains("please") || t.contains("provide") || t.contains("need")) &&
               (t.contains("raw") || t.contains("words") || t.contains("input") || t.contains("gesture"))
    }
}
