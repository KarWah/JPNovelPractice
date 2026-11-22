/**
 * Browser-native Japanese Speech Synthesis helper
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }
  if (cachedVoices.length > 0) {
    return cachedVoices;
  }
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

/**
 * Find the highest quality Japanese voice available in the browser/OS
 */
export function getJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (voices.length === 0) return null;

  // 1. Prefer natural / neural Japanese voices (Edge/Chrome on Windows/Mac)
  const naturalJa = voices.find(
    (v) =>
      (v.lang.startsWith("ja") || v.lang === "ja-JP") &&
      (v.name.includes("Natural") || v.name.includes("Online") || v.name.includes("Google") || v.name.includes("Nanami") || v.name.includes("Ayumi"))
  );
  if (naturalJa) return naturalJa;

  // 2. Any Japanese voice
  const anyJa = voices.find((v) => v.lang.startsWith("ja") || v.lang === "ja-JP");
  if (anyJa) return anyJa;

  return null;
}

export interface SpeakOptions {
  rate?: number;   // 0.8 = slow/clear, 1.0 = normal
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Pronounce Japanese text aloud
 */
export function speakJapanese(text: string, options: SpeakOptions = {}): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  // Cancel any currently playing speech to avoid queue pileup
  window.speechSynthesis.cancel();

  if (!text || text.trim() === "") return false;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = options.rate ?? 0.95; // Slightly slower than 1.0 for better learner clarity
  utterance.pitch = options.pitch ?? 1.0;

  const voice = getJapaneseVoice();
  if (voice) {
    utterance.voice = voice;
  }

  if (options.onStart) {
    utterance.onstart = options.onStart;
  }

  utterance.onend = () => {
    if (options.onEnd) options.onEnd();
  };

  utterance.onerror = (e) => {
    // If it was cancelled intentionally by another click, don't treat as error
    if (e.error === "canceled" || e.error === "interrupted") {
      if (options.onEnd) options.onEnd();
      return;
    }
    if (options.onError) options.onError(e);
    if (options.onEnd) options.onEnd();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
