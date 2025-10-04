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
    private val gestureHistory = mutableListOf<String>()
    private val sentenceGestures = mutableListOf<String>()
    private val sentences = mutableListOf<String>()
    private var isBuildingSentence = false
    private var lastGestureAddedTime = 0L
    private var noHandsStartTime: Long? = null
    private var ttsHelper: TtsHelper? = null
    var onSentenceUpdate: ((String) -> Unit)? = null
    
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
                val topCategory = flattenedCategories.firstOrNull()
                if (categories.size == 2 && topCategory?.categoryName()?.startsWith("TwoHand_") == true) {
                    gesture = cleanGestureName(topCategory.categoryName())
                    score = topCategory.score()
                } else if (categories.size == 1) {
                    gesture = cleanGestureName(topCategory?.categoryName())
                    score = topCategory?.score()
                } else {
                    val firstHandTop = categories[0].filter { it.score() >= MIN_CONFIDENCE }.maxByOrNull { it.score() }
                    val secondHandTop = categories[1].filter { it.score() >= MIN_CONFIDENCE }.maxByOrNull { it.score() }
                    if (firstHandTop != null && secondHandTop != null && firstHandTop.categoryName() == secondHandTop.categoryName()) {
                        gesture = cleanGestureName(firstHandTop.categoryName())
                        score = firstHandTop.score()
                    } else {
                        gesture = NONE_GESTURE
                        score = 0f
                    }
                }
            }
        }

        gestureHistory.add(gesture ?: NO_HANDS)
        if (gestureHistory.size > HISTORY_SIZE) gestureHistory.removeAt(0)
        val smoothedGesture = gestureHistory.groupingBy { it }.eachCount().maxByOrNull { it.value }?.key ?: NO_HANDS
        Log.d(TAG, "Detected gesture: $smoothedGesture, Score: $score, History: $gestureHistory")

        if (smoothedGesture == NO_HANDS) {
            if (noHandsStartTime == null && isBuildingSentence && sentenceGestures.isNotEmpty()) {
                noHandsStartTime = currentTime
                Log.d(TAG, "Started No Hands Detected timer at $noHandsStartTime")
            }
            if (noHandsStartTime != null && currentTime - noHandsStartTime!! >= NO_HANDS_TIMEOUT_MS && isBuildingSentence && sentenceGestures.isNotEmpty()) {
                val newSentence = getFormattedSentence()
                sentences.add(newSentence)
                Log.d(TAG, "Finalized sentence after 3s No Hands: $newSentence, All sentences: $sentences")
                onSentenceUpdate?.invoke(newSentence)
                adapterCategories = mutableListOf(Category.create(score ?: 0f, 0, smoothedGesture, smoothedGesture))
                sentences.takeLast(MAX_DISPLAYED_SENTENCES).forEachIndexed { index, sentence ->
                    adapterCategories.add(Category.create(1f, index + 1, sentence, sentence))
                }
                sentenceGestures.clear()
                isBuildingSentence = false
                noHandsStartTime = null
                Log.d(TAG, "Reset sentence-building state after finalization")
                notifyDataSetChanged()
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

        if (adapterCategories.isEmpty() || adapterCategories[0]?.categoryName() != smoothedGesture) {
            adapterCategories[0] = Category.create(score ?: 0f, 0, smoothedGesture, smoothedGesture)
            notifyDataSetChanged()
        }
    }

    fun getFormattedSentence(): String {
        if (sentenceGestures.isEmpty()) return ""
        val sentence = sentenceGestures.joinToString(", ") { it.lowercase(Locale.US) }
        return sentence.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() } + "."
    }

    fun getTopGestureName(): String = adapterCategories.getOrNull(0)?.categoryName() ?: NO_HANDS
    
    @SuppressLint("NotifyDataSetChanged")
    fun addSpokenSentence(text: String) {
        if (text.isNotEmpty()) {
            sentences.add(text)
            Log.d(TAG, "Added spoken sentence: $text, All sentences: $sentences")
            // Update adapter categories to show new sentence
            adapterCategories = mutableListOf(adapterCategories[0]) // Keep current gesture
            sentences.takeLast(MAX_DISPLAYED_SENTENCES).forEachIndexed { index, sentence ->
                adapterCategories.add(Category.create(1f, index + 1, sentence, sentence))
            }
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
        adapterCategories.getOrNull(position)?.let { category ->
            Log.d(TAG, "Binding label: ${category.categoryName()}, isSentence: ${position >= 1}")
            holder.bind(category.categoryName(), category.score(), position >= 1, if (position >= 1) sentences.size - (MAX_DISPLAYED_SENTENCES - position) else 0)
        } ?: holder.bind(NO_VALUE, 0f, position >= 1, if (position >= 1) sentences.size - (MAX_DISPLAYED_SENTENCES - position) else 0)
    }

    override fun getItemCount(): Int = adapterCategories.size

    inner class ViewHolder(private val binding: ItemGestureRecognizerResultBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(label: String?, score: Float?, isSentence: Boolean, sentenceIndex: Int) {
            with(binding) {
                tvLabel.text = if (isSentence && sentenceIndex > 0) "${sentenceIndex}. ${label ?: NO_VALUE}" else (label ?: NO_VALUE)
                tvScore.text = if (score != null && score > 0f && !isSentence) String.format(Locale.US, "%.2f", score) else ""
                tvLabel.setTextColor(0xFF000000.toInt())
                tvScore.setTextColor(0xFF000000.toInt())
                tvLabel.setTypeface(null, if (isSentence) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
                tvLabel.textSize = if (isSentence) 18f else 16f
                
                // Show TTS button only for sentences
                btnTts.visibility = if (isSentence && label != null && label.isNotEmpty()) 
                    android.view.View.VISIBLE else android.view.View.GONE
                
                // Set up TTS button click listener
                btnTts.setOnClickListener {
                    if (isSentence && label != null && label.isNotEmpty()) {
                        val textToSpeak = label.replaceFirst(Regex("^\\d+\\.\\s*"), "")
                        ttsHelper?.speak(textToSpeak)
                    }
                }
            }
        }
    }
}
