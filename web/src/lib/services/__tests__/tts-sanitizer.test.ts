import { describe, it, expect } from 'vitest'
import { TTSSanitizer } from '../tts-sanitizer'

describe('TTSSanitizer', () => {
  describe('sanitize', () => {
    // ===========================================
    // BASIC VALIDATION
    // ===========================================

    it('accepts valid text', () => {
      const result = TTSSanitizer.sanitize('Hello World!', 100)
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello World!')
    })

    it('rejects empty input', () => {
      const result = TTSSanitizer.sanitize('', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Empty message')
    })

    it('rejects whitespace-only input', () => {
      const result = TTSSanitizer.sanitize('   \t\n  ', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Empty message')
    })

    it('truncates text exceeding max length', () => {
      const result = TTSSanitizer.sanitize('Hello World!', 5)
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello')
    })

    // ===========================================
    // BLOCKLIST FILTERING
    // ===========================================

    it('rejects text with blocked words', () => {
      const result = TTSSanitizer.sanitize('What the fuck', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Contains blocked words')
    })

    it('rejects text with blocked words (case insensitive)', () => {
      const result = TTSSanitizer.sanitize('What the FUCK', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Contains blocked words')
    })

    it('rejects various profanity', () => {
      const blockedWords = ['shit', 'bitch', 'cunt', 'dick']
      for (const word of blockedWords) {
        const result = TTSSanitizer.sanitize(`This is ${word}`, 100)
        expect(result.valid).toBe(false)
        expect(result.rejectionReason).toBe('Contains blocked words')
      }
    })

    it('rejects slurs', () => {
      const result = TTSSanitizer.sanitize('Some slur nigga here', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Contains blocked words')
    })

    it('rejects dangerous phrases', () => {
      const result = TTSSanitizer.sanitize('kys loser', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Contains blocked words')
    })

    // ===========================================
    // REPETITION DETECTION
    // ===========================================

    it('rejects excessive character repetition', () => {
      const result = TTSSanitizer.sanitize('wwwwwww', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Excessive character repetition')
    })

    it('rejects excessive exclamation marks', () => {
      const result = TTSSanitizer.sanitize('Hello!!!!!!!', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Excessive character repetition')
    })

    it('rejects repeated numbers', () => {
      const result = TTSSanitizer.sanitize('777777777', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Excessive character repetition')
    })

    it('allows moderate repetition', () => {
      const result = TTSSanitizer.sanitize('Wooow!!!', 100)
      expect(result.valid).toBe(true)
    })

    // ===========================================
    // PHONETIC SPAM DETECTION
    // ===========================================

    it('rejects soi soi spam', () => {
      const result = TTSSanitizer.sanitize('soi soi soi soi', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Phonetic spam detected')
    })

    it('rejects fuh fuh spam', () => {
      const result = TTSSanitizer.sanitize('fuh fuh fuh fuh', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Phonetic spam detected')
    })

    it('rejects uwu spam', () => {
      const result = TTSSanitizer.sanitize('uwu uwu uwu', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Phonetic spam detected')
    })

    it('rejects reeee spam (caught by repetition)', () => {
      // Note: "reeeeeeee" triggers repetition detection before phonetic spam
      const result = TTSSanitizer.sanitize('reeeeeeee', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Excessive character repetition')
    })

    // ===========================================
    // URL DETECTION
    // ===========================================

    it('rejects URLs', () => {
      const result = TTSSanitizer.sanitize('Check out https://example.com', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('URLs are not allowed')
    })

    it('rejects https URLs with www', () => {
      const result = TTSSanitizer.sanitize('Go to https://www.example.com', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('URLs are not allowed')
    })

    it('rejects domain-like patterns', () => {
      const result = TTSSanitizer.sanitize('Visit google.com now', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('URLs are not allowed')
    })

    // ===========================================
    // CAPS DETECTION
    // ===========================================

    it('rejects excessive caps', () => {
      const result = TTSSanitizer.sanitize('THIS IS ALL CAPS TEXT HERE', 100)
      expect(result.valid).toBe(false)
      expect(result.rejectionReason).toBe('Excessive caps detected')
    })

    it('allows moderate caps', () => {
      const result = TTSSanitizer.sanitize('This is IMPORTANT but not all caps', 100)
      expect(result.valid).toBe(true)
    })

    it('allows short caps messages', () => {
      // Short messages are exempt from caps check
      const result = TTSSanitizer.sanitize('OMG WOW', 100)
      expect(result.valid).toBe(true)
    })

    // ===========================================
    // WHITESPACE NORMALIZATION
    // ===========================================

    it('normalizes multiple spaces', () => {
      const result = TTSSanitizer.sanitize('Hello    World', 100)
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello World')
    })

    it('trims leading and trailing whitespace', () => {
      const result = TTSSanitizer.sanitize('  Hello World  ', 100)
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello World')
    })

    it('normalizes tabs and newlines', () => {
      const result = TTSSanitizer.sanitize('Hello\t\nWorld', 100)
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello World')
    })

    // ===========================================
    // EDGE CASES
    // ===========================================

    it('handles unicode characters', () => {
      const result = TTSSanitizer.sanitize('Hello 世界 emoji 🎉', 100)
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('Hello 世界 emoji 🎉')
    })

    it('handles numbers and symbols', () => {
      const result = TTSSanitizer.sanitize('Price: $100 + 20% tax', 100)
      expect(result.valid).toBe(true)
    })
  })

  describe('isValid', () => {
    it('returns true for valid text', () => {
      expect(TTSSanitizer.isValid('Hello', 100)).toBe(true)
    })

    it('returns false for invalid text', () => {
      expect(TTSSanitizer.isValid('', 100)).toBe(false)
      expect(TTSSanitizer.isValid('fuck', 100)).toBe(false)
    })
  })
})
