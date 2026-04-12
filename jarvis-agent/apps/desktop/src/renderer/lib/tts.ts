export type TtsStatus = "idle" | "speaking" | "muted" | "error";

export interface TtsSpeakOptions {
  volume?: number;
  lang?: string;
  rate?: number;
}

export interface TtsAdapterOptions {
  onStatusChange: (status: TtsStatus, note: string) => void;
  onSpoken: (message: string) => void;
  onError: (message: string) => void;
}

export interface TtsAdapter {
  speak: (message: string, options?: TtsSpeakOptions) => Promise<boolean>;
  stop: () => void;
  getStatus: () => TtsStatus;
  setEnabled: (enabled: boolean) => void;
}

export function createSpeechSynthesisTtsAdapter(options: TtsAdapterOptions): TtsAdapter {
  let enabled = true;
  let status: TtsStatus = "idle";

  function setStatus(next: TtsStatus, note: string): void {
    status = next;
    options.onStatusChange(next, note);
  }

  return {
    async speak(message: string, speakOptions?: TtsSpeakOptions) {
      if (!enabled) {
        setStatus("muted", "Sesli geri bildirim kapali.");
        return false;
      }

      if (!("speechSynthesis" in window)) {
        setStatus("error", "Sesli geri bildirim su anda kullanilamiyor.");
        options.onError("Sesli geri bildirim su anda kullanilamiyor.");
        return false;
      }

      return new Promise<boolean>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = speakOptions?.lang ?? "tr-TR";
        utterance.volume = speakOptions?.volume ?? 1;
        utterance.rate = speakOptions?.rate ?? 1;

        utterance.onstart = () => setStatus("speaking", message);
        utterance.onend = () => {
          setStatus("idle", "Sesli geri bildirim hazir.");
          options.onSpoken(message);
          resolve(true);
        };
        utterance.onerror = () => {
          setStatus("error", "Sesli geri bildirim oynatilamadi.");
          options.onError("Sesli geri bildirim oynatilamadi.");
          resolve(false);
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
    },
    stop() {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setStatus(enabled ? "idle" : "muted", enabled ? "Sesli geri bildirim durduruldu." : "Sesli geri bildirim kapali.");
    },
    getStatus() {
      return status;
    },
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      if (!nextEnabled) {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        setStatus("muted", "Sesli geri bildirim kapali.");
      } else {
        setStatus("idle", "Sesli geri bildirim hazir.");
      }
    }
  };
}
