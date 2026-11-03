import { useEffect, useState, useSyncExternalStore } from 'react'
import { estimateMs, wordIndexAt } from './speechText'

/*
 * Speech engine for the tutor, on the browser's Web Speech API.
 *
 * - One utterance per segment, driven by onstart / onend / onerror. Every utterance gets a token,
 *   so late events from a cancelled utterance are ignored.
 * - Pause is cancel-and-remember: resume speaks again from the word that was playing. This avoids
 *   the many browser bugs around speechSynthesis.pause()/resume().
 * - cancel() before every speak() clears Chrome's occasional stuck queue; a start watchdog retries
 *   once and then reports the problem instead of hanging.
 * - Chrome's network voices stop after about 15 seconds; a pause()/resume() keep-alive prevents it.
 * - Word highlighting comes from onboundary when the voice fires it.
 * - Without speechSynthesis the engine runs silently on timers so captions still advance.
 */

export type SpeechStatus = 'idle' | 'speaking' | 'paused' | 'done'

export interface SpeechItem {
  text: string
  /** Character offset of every word of `text`. */
  starts: number[]
  /** Silence after this item, in ms. */
  pauseAfter?: number
}

export interface VoiceInfo {
  uri: string
  name: string
  lang: string
  local: boolean
}

export interface SpeechState {
  /** speechSynthesis exists in this browser. */
  supported: boolean
  /** Captions advance on timers with no audio. */
  silent: boolean
  status: SpeechStatus
  index: number
  count: number
  /** Word of the current item being spoken, -1 = none yet. */
  word: number
  /** Word boundaries are known (the voice fires them, or silent timing). */
  wordSync: boolean
  /** A one-off utterance (quick-check prompt or feedback) is playing. */
  saying: boolean
  voices: VoiceInfo[]
  /** Saved voice choice ('' = automatic). */
  voiceURI: string
  /** The voice actually used. */
  activeVoice: VoiceInfo | null
  rate: number
  /** Problem to show the user, if any. */
  notice: string | null
}

export const RATES = [0.75, 0.9, 1, 1.1, 1.25, 1.5]
const RATE_KEY = 'taxlaw-tutor-rate'
const VOICE_KEY = 'taxlaw-tutor-voice'
const MIN_RATE = 0.75
const MAX_RATE = 1.5

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') return null
  return window.speechSynthesis
}

function readRate(): number {
  try {
    const v = Number(localStorage.getItem(RATE_KEY))
    if (Number.isFinite(v) && v >= MIN_RATE && v <= MAX_RATE) return v
  } catch {
    /* storage blocked */
  }
  return 1
}

function readVoice(): string {
  try {
    return localStorage.getItem(VOICE_KEY) ?? ''
  } catch {
    return ''
  }
}

function save(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* storage blocked */
  }
}

function info(v: SpeechSynthesisVoice): VoiceInfo {
  return { uri: v.voiceURI || v.name, name: v.name, lang: v.lang, local: v.localService }
}

/** Ranks voices: Indian English first, then British, then American, then other English. */
export function voiceRank(v: { name: string; lang: string; local: boolean }): number {
  const lang = v.lang.replace('_', '-').toLowerCase()
  let s = lang === 'en-in' ? 400 : lang === 'en-gb' ? 300 : lang === 'en-us' ? 200 : lang.startsWith('en') ? 100 : 0
  if (!s) return 0
  const name = v.name.toLowerCase()
  if (/natural|neural|premium|enhanced/.test(name)) s += 30
  if (v.local) s += 10
  else if (/google|online/.test(name)) s += 8
  return s
}

function isChromeDesktop(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/Android/i.test(ua)
}

let unlocked = false

/**
 * Call inside a click handler that will start speech after navigating. Some mobile browsers
 * (iOS Safari) only allow speech that begins during a user gesture.
 */
export function unlockSpeech() {
  const synth = getSynth()
  if (!synth || unlocked) return
  unlocked = true
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
  } catch {
    /* ignore */
  }
}

export class SpeechController {
  private synth = getSynth()
  private items: SpeechItem[] = []
  private listeners = new Set<() => void>()
  private token = 0
  private startedToken = -1
  /** Keep a reference to the live utterance: Chrome drops events of garbage-collected ones. */
  private utterance: SpeechSynthesisUtterance | null = null
  private timeouts = new Set<number>()
  private interval = 0
  private resumeChar = 0
  private attached = 0
  private polls: number[] = []
  private sayDone: (() => void) | null = null
  private sawFirstStart = false
  /** Called when the last item has been spoken. */
  onFinish: (() => void) | null = null
  state: SpeechState

  constructor() {
    this.state = {
      supported: !!this.synth,
      silent: !this.synth,
      status: 'idle',
      index: 0,
      count: 0,
      word: -1,
      wordSync: !this.synth,
      saying: false,
      voices: [],
      voiceURI: readVoice(),
      activeVoice: null,
      rate: readRate(),
      notice: null,
    }
  }

  /* ---------- store plumbing ---------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getState = () => this.state

  private set(patch: Partial<SpeechState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  attach() {
    this.attached++
    const synth = this.synth
    if (!synth || this.attached > 1) return
    synth.addEventListener?.('voiceschanged', this.loadVoices)
    // React cleanup does not run on reload, and Chrome can keep talking across it.
    window.addEventListener('pagehide', this.onPageHide)
    this.loadVoices()
    // Some browsers never fire voiceschanged; poll a few times as well.
    this.polls = [250, 1000, 3000].map((ms) => window.setTimeout(this.loadVoices, ms))
  }

  detach() {
    this.attached = Math.max(0, this.attached - 1)
    if (this.attached > 0) return
    this.halt()
    this.polls.forEach((t) => clearTimeout(t))
    this.synth?.removeEventListener?.('voiceschanged', this.loadVoices)
    window.removeEventListener('pagehide', this.onPageHide)
  }

  private onPageHide = () => {
    this.halt()
  }

  private loadVoices = () => {
    const synth = this.synth
    if (!synth) return
    let list: SpeechSynthesisVoice[] = []
    try {
      list = synth.getVoices()
    } catch {
      return
    }
    if (!list.length) return
    const voices = list.map(info)
    const same =
      voices.length === this.state.voices.length && voices.every((v, i) => v.uri === this.state.voices[i].uri)
    const active = this.resolveVoice()
    if (!same || (active ? info(active).uri : null) !== (this.state.activeVoice?.uri ?? null)) {
      this.set({ voices: same ? this.state.voices : voices, activeVoice: active ? info(active) : null })
    }
  }

  private resolveVoice(): SpeechSynthesisVoice | null {
    let list: SpeechSynthesisVoice[] = []
    try {
      list = this.synth?.getVoices() ?? []
    } catch {
      return null
    }
    if (!list.length) return null
    const wanted = this.state.voiceURI
    if (wanted) {
      const v = list.find((x) => (x.voiceURI || x.name) === wanted) ?? list.find((x) => x.name === wanted)
      if (v) return v
    }
    let best: SpeechSynthesisVoice | null = null
    let bestRank = -1
    for (const v of list) {
      const r = voiceRank({ name: v.name, lang: v.lang, local: v.localService }) + (v.default ? 1 : 0)
      if (r > bestRank) {
        best = v
        bestRank = r
      }
    }
    return best
  }

  /* ---------- timers ---------- */

  private later(token: number, fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id)
      if (token === this.token) fn()
    }, ms)
    this.timeouts.add(id)
  }

  private clearTimers() {
    this.timeouts.forEach((t) => clearTimeout(t))
    this.timeouts.clear()
    if (this.interval) clearInterval(this.interval)
    this.interval = 0
  }

  /** Stops everything without touching the visible state (used on unmount). */
  private halt() {
    this.token++
    this.clearTimers()
    this.sayDone = null
    this.utterance = null
    this.cancelSynth()
  }

  private silence() {
    this.token++
    this.clearTimers()
    this.utterance = null
    this.cancelSynth()
  }

  /** When was speech last cut off mid-utterance (see queueSpeak). */
  private lastCancel = 0

  private cancelSynth() {
    const synth = this.synth
    if (!synth) return
    try {
      if (synth.speaking || synth.pending) this.lastCancel = Date.now()
      synth.cancel()
    } catch {
      /* ignore */
    }
  }

  /**
   * Chrome can drop an utterance queued in the same moment cancel() cut another one off,
   * so speak after a short pause in that case (e.g. pressing Next mid-sentence).
   */
  private queueSpeak(token: number, u: SpeechSynthesisUtterance, onFail: () => void) {
    const synth = this.synth
    if (!synth) return
    const run = (attempt: number) => {
      try {
        if ((synth.speaking || synth.pending) && attempt < 3) {
          this.cancelSynth()
          this.later(token, () => run(attempt + 1), 120)
          return
        }
        synth.speak(u)
        if (synth.paused) synth.resume()
      } catch {
        onFail()
      }
    }
    const wait = 120 - (Date.now() - this.lastCancel)
    if (wait > 0) this.later(token, () => run(0), wait)
    else run(0)
  }

  /* ---------- lesson playback ---------- */

  /** Loads a new lesson. Stops any speech and waits at the first item. */
  load(items: SpeechItem[]) {
    this.silence()
    this.sayDone = null
    this.items = items
    this.resumeChar = 0
    this.set({ status: 'idle', index: 0, count: items.length, word: -1, saying: false, notice: null })
  }

  play() {
    if (!this.items.length) return
    if (this.state.saying) this.cancelSay()
    const { status } = this.state
    if (status === 'speaking') return
    if (status === 'paused') {
      this.resume()
      return
    }
    if (status === 'done') this.set({ index: 0 })
    this.speakCurrent(0)
  }

  pause() {
    if (this.state.saying) {
      this.cancelSay()
      return
    }
    if (this.state.status !== 'speaking') return
    const item = this.items[this.state.index]
    this.resumeChar = item && this.state.wordSync && this.state.word > 0 ? (item.starts[this.state.word] ?? 0) : 0
    this.silence()
    this.set({ status: 'paused' })
  }

  resume() {
    if (this.state.status !== 'paused') return
    const from = this.resumeChar
    this.resumeChar = 0
    this.speakCurrent(from)
  }

  toggle() {
    if (this.state.status === 'speaking' || this.state.saying) this.pause()
    else this.play()
  }

  /** Stops speech and keeps the position; Play starts that item again. */
  stop() {
    this.silence()
    this.sayDone = null
    this.resumeChar = 0
    if (this.state.saying || this.state.status === 'speaking') {
      this.set({ saying: false, status: this.state.status === 'speaking' ? 'paused' : this.state.status })
    }
  }

  /** Moves to an item. Keeps playing if it was playing (or when `play` is true). */
  jump(index: number, play?: boolean) {
    if (!this.items.length) return
    const i = Math.max(0, Math.min(this.items.length - 1, index))
    const keepPlaying = play ?? this.state.status === 'speaking'
    this.silence()
    this.sayDone = null
    this.resumeChar = 0
    this.set({ index: i, word: -1, saying: false, status: keepPlaying ? 'speaking' : 'paused' })
    if (keepPlaying) this.speakCurrent(0)
  }

  /** Next item; on the last item this finishes the lesson (which leads to the quick check). */
  next() {
    if (!this.items.length) return
    if (this.state.index < this.items.length - 1) {
      this.jump(this.state.index + 1)
      return
    }
    this.silence()
    this.sayDone = null
    this.set({ status: 'done', word: -1, saying: false })
    this.onFinish?.()
  }

  prev() {
    this.jump(this.state.index - 1)
  }

  private advance() {
    const nextIndex = this.state.index + 1
    if (nextIndex >= this.items.length) {
      this.silence()
      this.set({ status: 'done', word: -1 })
      this.onFinish?.()
      return
    }
    const gap = this.items[this.state.index]?.pauseAfter ?? 180
    this.token++
    const token = this.token
    this.clearTimers()
    this.set({ index: nextIndex, word: -1 })
    this.later(token, () => this.speakCurrent(0), gap)
  }

  private speakCurrent(fromChar: number) {
    const item = this.items[this.state.index]
    if (!item) return
    this.silence()
    const token = this.token
    if (this.state.silent || !this.synth) {
      this.runSilent(token, item, fromChar)
      return
    }
    this.startUtterance(token, item, fromChar, 0)
  }

  private startUtterance(token: number, item: SpeechItem, fromChar: number, attempt: number) {
    const synth = this.synth
    if (!synth) return
    if (this.interval) clearInterval(this.interval)
    this.interval = 0
    const offset = fromChar > 0 && fromChar < item.text.length ? fromChar : 0
    const u = new SpeechSynthesisUtterance(offset ? item.text.slice(offset) : item.text)
    const voice = this.resolveVoice()
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else u.lang = 'en-IN'
    u.rate = this.state.rate
    u.onstart = () => {
      if (token !== this.token) return
      this.startedToken = token
      this.sawFirstStart = true
      if (this.state.status !== 'speaking' || this.state.notice) this.set({ status: 'speaking', notice: null })
      this.armStuckGuard(token, item.text.length - offset)
    }
    u.onboundary = (e) => {
      if (token !== this.token) return
      if (e.name && e.name !== 'word') return
      const w = wordIndexAt(item.starts, offset + e.charIndex)
      if (w !== this.state.word || !this.state.wordSync) this.set({ word: w, wordSync: true })
    }
    u.onend = () => {
      if (token !== this.token) return
      this.utterance = null
      this.advance()
    }
    u.onerror = (e) => {
      if (token !== this.token) return
      this.utterance = null
      this.handleError(e.error)
    }
    this.utterance = u
    const word = offset ? wordIndexAt(item.starts, offset) : -1
    this.set({ status: 'speaking', word, activeVoice: voice ? info(voice) : this.state.activeVoice })
    this.queueSpeak(token, u, () => this.handleError('synthesis-failed'))
    // Watchdog: some engines silently drop an utterance. Retry once, then tell the user.
    this.later(
      token,
      () => {
        if (this.startedToken === token) return
        if (synth.speaking && !synth.pending) {
          this.startedToken = token // speaking without an onstart event: trust it
          return
        }
        if (attempt === 0) this.startUtterance(++this.token, item, fromChar, 1)
        else {
          this.silence()
          this.set({
            status: 'paused',
            notice: 'The voice did not start. Press Play to try again, pick another voice, or switch to silent captions.',
          })
        }
      },
      this.sawFirstStart ? 3500 : 6000,
    )
    if (voice && !voice.localService && isChromeDesktop()) {
      this.interval = window.setInterval(() => {
        if (token !== this.token) return
        if (synth.speaking && !synth.paused) {
          synth.pause()
          synth.resume()
        }
      }, 9000)
    }
  }

  /** If onend never arrives (a known engine bug), move on instead of hanging. */
  private armStuckGuard(token: number, chars: number) {
    const expected = estimateMs('x '.repeat(Math.max(1, Math.round(chars / 6))), this.state.rate)
    const check = (round: number) => {
      const synth = this.synth
      if (!synth) return
      if (!synth.speaking) this.advance()
      else if (round === 0) this.later(token, () => check(1), expected + 5000)
      else this.advance()
    }
    this.later(token, () => check(0), expected * 2 + 6000)
  }

  private handleError(error: string) {
    switch (error) {
      case 'interrupted':
      case 'canceled':
        return
      case 'not-allowed':
        this.silence()
        this.set({ status: 'idle', notice: 'Your browser needs a tap before it can speak. Press Play to start.' })
        return
      case 'text-too-long':
        this.advance()
        return
      case 'network':
        this.silence()
        this.set({ status: 'paused', notice: 'This voice needs an internet connection. Pick another voice, or press Play to retry.' })
        return
      default:
        this.silence()
        this.set({ status: 'paused', notice: 'The speech engine reported a problem. Press Play to retry, or pick another voice.' })
    }
  }

  /* ---------- silent mode ---------- */

  private runSilent(token: number, item: SpeechItem, fromChar: number) {
    const total = item.starts.length
    let w = fromChar > 0 ? Math.max(0, wordIndexAt(item.starts, fromChar)) : 0
    const perWord = 60_000 / (165 * this.state.rate)
    this.set({ status: 'speaking', word: w, wordSync: true })
    this.interval = window.setInterval(() => {
      if (token !== this.token) return
      w++
      if (w >= total) {
        clearInterval(this.interval)
        this.interval = 0
        this.advance()
      } else this.set({ word: w })
    }, perWord)
  }

  /** Switch to timed captions with no audio (for browsers whose voice will not start). */
  setSilent(silent: boolean) {
    if (!this.synth && !silent) return
    const wasSpeaking = this.state.status === 'speaking'
    this.silence()
    this.set({ silent, wordSync: silent, notice: null, status: wasSpeaking ? 'paused' : this.state.status })
    if (wasSpeaking) this.resume()
  }

  /* ---------- one-off utterances (quick check) ---------- */

  /** Speaks a single text outside the lesson, then calls onDone (not called if cancelled). */
  say(text: string, onDone?: () => void) {
    this.silence()
    const token = this.token
    this.sayDone = onDone ?? null
    this.set({ saying: true, word: -1 })
    const finish = () => {
      if (token !== this.token) return
      this.utterance = null
      const cb = this.sayDone
      this.sayDone = null
      this.set({ saying: false })
      cb?.()
    }
    const synth = this.synth
    if (!synth || this.state.silent) {
      this.later(token, finish, Math.min(9000, estimateMs(text, this.state.rate) * 0.6))
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    const voice = this.resolveVoice()
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else u.lang = 'en-IN'
    u.rate = this.state.rate
    let started = false
    u.onstart = () => {
      started = true
    }
    u.onend = finish
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return
      finish()
    }
    this.utterance = u
    this.queueSpeak(token, u, finish)
    this.later(token, () => !started && !synth.speaking && finish(), 6000)
    this.later(token, finish, estimateMs(text, this.state.rate) * 2.5 + 8000)
    if (voice && !voice.localService && isChromeDesktop()) {
      this.interval = window.setInterval(() => {
        if (token !== this.token) return
        if (synth.speaking && !synth.paused) {
          synth.pause()
          synth.resume()
        }
      }, 9000)
    }
  }

  cancelSay() {
    if (!this.state.saying) return
    this.silence()
    this.sayDone = null
    this.set({ saying: false })
  }

  /* ---------- settings ---------- */

  setRate(rate: number) {
    const r = Math.max(MIN_RATE, Math.min(MAX_RATE, rate))
    save(RATE_KEY, String(r))
    const restart = this.restartPoint()
    this.set({ rate: r })
    if (restart !== null) this.speakCurrent(restart)
  }

  setVoice(uri: string) {
    save(VOICE_KEY, uri)
    const restart = this.restartPoint()
    this.set({ voiceURI: uri, wordSync: this.state.silent })
    const active = this.resolveVoice()
    this.set({ activeVoice: active ? info(active) : null })
    if (restart !== null) this.speakCurrent(restart)
  }

  /** Where to pick up again after a settings change while speaking, or null when not speaking. */
  private restartPoint(): number | null {
    if (this.state.status !== 'speaking' || this.state.saying) return null
    const item = this.items[this.state.index]
    return item && this.state.wordSync && this.state.word > 0 ? (item.starts[this.state.word] ?? 0) : 0
  }
}

/** One speech controller per mounted player. Speech stops when the component unmounts. */
export function useSpeech(): [SpeechState, SpeechController] {
  const [ctl] = useState(() => new SpeechController())
  useEffect(() => {
    ctl.attach()
    return () => ctl.detach()
  }, [ctl])
  const state = useSyncExternalStore(ctl.subscribe, ctl.getState, ctl.getState)
  return [state, ctl]
}
