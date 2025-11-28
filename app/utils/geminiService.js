import axios from 'axios';

// Gemini API configuration - matching the Android implementation
// TODO: Replace with your NEW API key from https://aistudio.google.com/apikey
const GEMINI_API_KEY = 'AIzaSyBi-M2Rkbm68E9Xn54GQIUyQpHazU5fxhI';
const GEMINI_MODEL_PRIMARY = 'gemini-2.0-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-2.5-flash-lite';

const getModelEndpoint = (model) => {
  // gemini-2.0 and 2.5 models typically on v1beta at time of writing
  const base = model.startsWith('gemini-2.') 
    ? 'https://generativelanguage.googleapis.com/v1beta/models/' 
    : 'https://generativelanguage.googleapis.com/v1/models/';
  return `${base}${model}:generateContent?key=${GEMINI_API_KEY}`;
};

class GeminiService {
  async generateSentence(words) {
    try {
      if (!words || words.length === 0) {
        throw new Error('No words provided');
      }

      // Create a prompt matching the Android implementation
      const rawSentence = words.join(', ');
      const prompt = `You are turning raw gesture words into an easy-to-read sentence. Keep it concise and grammatical. Raw: ${rawSentence}`;
      
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 64
        }
      };

      // Try primary model first
      let response;
      try {
        response = await axios.post(
          getModelEndpoint(GEMINI_MODEL_PRIMARY),
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json; charset=utf-8'
            },
            timeout: 15000 // 15 second timeout
          }
        );
      } catch (primaryError) {
        // If primary fails with 400 or 404, try fallback
        if (primaryError.response && (primaryError.response.status === 400 || primaryError.response.status === 404)) {
          console.warn(`Primary model ${GEMINI_MODEL_PRIMARY} failed with ${primaryError.response.status}, trying fallback ${GEMINI_MODEL_FALLBACK}`);
          
          response = await axios.post(
            getModelEndpoint(GEMINI_MODEL_FALLBACK),
            requestBody,
            {
              headers: {
                'Content-Type': 'application/json; charset=utf-8'
              },
              timeout: 15000
            }
          );
        } else {
          throw primaryError;
        }
      }

      // Parse response - candidates[0].content.parts[0].text
      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const generatedSentence = response.data.candidates[0].content.parts[0].text
          .replace(/\n/g, ' ')
          .trim();
        
        // Check if response is trivial or prompt-like (matching Android logic)
        if (this.isTrivialSentence(generatedSentence) || this.isPromptLike(generatedSentence)) {
          return this.getFallbackSentence(words);
        }
        
        return generatedSentence;
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      console.error('Error generating sentence with Gemini:', error);
      
      // Fallback: return formatted sentence from words
      return this.getFallbackSentence(words);
    }
  }

  getFallbackSentence(words) {
    if (!words || words.length === 0) return '';
    
    const raw = words.join(', ').toLowerCase().trim();
    
    // Normalize whitespace
    const normalized = raw
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^,+|,+$/g, '');
    
    if (!normalized) return '';
    
    return normalized.charAt(0).toUpperCase() + normalized.slice(1) + '.';
  }

  isTrivialSentence(sentence) {
    if (!sentence) return true;
    const trimmed = sentence.trim().replace(/\.$/, '');
    if (!trimmed) return true;
    const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
    return alphaCount < 1;
  }

  isPromptLike(sentence) {
    if (!sentence) return false;
    const lower = sentence.toLowerCase();
    return (lower.includes('please') || lower.includes('provide') || lower.includes('need')) &&
           (lower.includes('raw') || lower.includes('words') || lower.includes('input') || lower.includes('gesture'));
  }

  async testConnection() {
    try {
      const response = await this.generateSentence(['hello', 'world']);
      return true;
    } catch (error) {
      console.error('Gemini API test failed:', error);
      return false;
    }
  }
}

export default new GeminiService();
