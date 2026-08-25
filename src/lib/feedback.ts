/**
 * Tap confirmation without looking at the screen.
 *
 * iOS Safari has no vibration API, so there is no haptic option on iPhone.
 * navigator.vibrate works on Android and is a no-op elsewhere. The audible
 * click is the confirmation that actually works everywhere. See DESIGN.md.
 */

let ctx: AudioContext | null = null

/** Must be called from a user gesture. The first tap unlocks audio for the rest. */
function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/** Short, dry, cuts through wind and crowd noise. */
export function click(): void {
  const ac = audioContext()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume()

  const now = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()

  osc.type = 'square'
  osc.frequency.setValueAtTime(1320, now)

  // Fast attack, fast decay. A blip, not a beep.
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.35, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)

  osc.connect(gain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.06)
}

/** Lower pitched, so undo does not sound like another tap. */
export function undoClick(): void {
  const ac = audioContext()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume()

  const now = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(420, now)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.3, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
  osc.connect(gain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.1)
}

/** No-op on iOS. Included because it costs nothing on the devices that support it. */
export function buzz(ms = 12): void {
  navigator.vibrate?.(ms)
}
