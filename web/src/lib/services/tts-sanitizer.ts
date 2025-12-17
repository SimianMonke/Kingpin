/**
 * TTS Sanitizer - Filters and validates text-to-speech input
 *
 * Rules:
 * 1. Blocklist: Standard profanity filter
 * 2. Repetition: Detect repeated chars (wwwwww, !!!!!!!, 7777777)
 * 3. Phonetic spam: Common TTS exploits (soi soi, fuh fuh, rapid consonants)
 * 4. Max length: Hard truncate at character limit
 * 5. Empty/whitespace: Reject
 */

export interface SanitizeResult {
  valid: boolean
  sanitized: string
  rejectionReason?: string
}

// Blocklist patterns - common profanity and slurs
const BLOCKLIST_PATTERNS = [
  /\b(fuck|fucker|fucking|fucked|fucks)\b/gi,
  /\b(shit|shitter|shitting|shitty)\b/gi,
  /\b(bitch|bitches|bitching)\b/gi,
  /\b(ass|asshole|asses)\b/gi,
  /\b(damn|damned|dammit)\b/gi,
  /\b(cunt|cunts)\b/gi,
  /\b(cock|cocks|cocksucker)\b/gi,
  /\b(dick|dicks|dickhead)\b/gi,
  /\b(pussy|pussies)\b/gi,
  /\b(whore|whores)\b/gi,
  /\b(slut|sluts)\b/gi,
  /\b(fag|faggot|fags)\b/gi,
  /\b(nigger|nigga|nigg[a@])\b/gi,
  /\b(retard|retarded)\b/gi,
  /\b(kys|kill\s*yourself)\b/gi,
  // Leetspeak variants
  /\b(f+u+c+k+|sh+[i1]+t+|b+[i1]+t+c+h+)\b/gi,
]

// Repetition threshold - more than this many repeated chars is spam
const REPETITION_THRESHOLD = 4

// Phonetic spam patterns - TTS exploits that sound annoying
const PHONETIC_SPAM_PATTERNS = [
  /\b(soi\s*){3,}/gi, // "soi soi soi" spam
  /\b(fuh\s*){3,}/gi, // "fuh fuh fuh" spam
  /\b(brrr+)\b/gi, // "brrrr" spam
  /\b(reee+)\b/gi, // "reeee" spam
  /\b(uwu\s*){2,}/gi, // "uwu uwu" spam
  /\b(owo\s*){2,}/gi, // "owo owo" spam
  /\b(nya+)\b/gi, // "nyaaa" spam
  /\b(eeee{4,})\b/gi, // Long vowel sounds
  /\b(aaaa{4,})\b/gi,
  /\b(oooo{4,})\b/gi,
]

// URL patterns - prevent link spam
// Note: Using non-global regex to avoid lastIndex state issues
const URL_PATTERN =
  /https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.(com|org|net|io|gg|tv|co|me)[^\s]*/i

export const TTSSanitizer = {
  /**
   * Sanitize TTS input for spam and abuse patterns
   */
  sanitize(input: string, maxLength: number): SanitizeResult {
    // 1. Empty check
    if (!input || input.trim().length === 0) {
      return { valid: false, sanitized: '', rejectionReason: 'Empty message' }
    }

    let text = input.trim()

    // 2. URL check - reject messages with links
    if (URL_PATTERN.test(text)) {
      return {
        valid: false,
        sanitized: '',
        rejectionReason: 'URLs are not allowed',
      }
    }

    // 3. Blocklist check
    for (const pattern of BLOCKLIST_PATTERNS) {
      if (pattern.test(text)) {
        return {
          valid: false,
          sanitized: '',
          rejectionReason: 'Contains blocked words',
        }
      }
    }

    // 4. Repetition check (e.g., "aaaaaa", "!!!!!", "777777")
    const repetitionRegex = new RegExp(`(.)\\1{${REPETITION_THRESHOLD},}`, 'g')
    if (repetitionRegex.test(text)) {
      return {
        valid: false,
        sanitized: '',
        rejectionReason: 'Excessive character repetition',
      }
    }

    // 5. Phonetic spam patterns (TTS exploits)
    for (const pattern of PHONETIC_SPAM_PATTERNS) {
      if (pattern.test(text)) {
        return {
          valid: false,
          sanitized: '',
          rejectionReason: 'Phonetic spam detected',
        }
      }
    }

    // 6. All caps check - more than 80% caps is spam
    const letters = text.replace(/[^a-zA-Z]/g, '')
    if (letters.length > 10) {
      const upperCount = (text.match(/[A-Z]/g) || []).length
      const capsRatio = upperCount / letters.length
      if (capsRatio > 0.8) {
        return {
          valid: false,
          sanitized: '',
          rejectionReason: 'Excessive caps detected',
        }
      }
    }

    // 7. Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim()

    // 8. Length check - truncate if needed
    if (text.length > maxLength) {
      text = text.slice(0, maxLength)
    }

    // 9. Final empty check after normalization
    if (text.length === 0) {
      return { valid: false, sanitized: '', rejectionReason: 'Empty message' }
    }

    return { valid: true, sanitized: text }
  },

  /**
   * Quick check if text is valid without full sanitization
   */
  isValid(input: string, maxLength: number): boolean {
    return this.sanitize(input, maxLength).valid
  },
}
