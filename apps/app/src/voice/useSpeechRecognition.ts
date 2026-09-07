import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/**
 * Speech-to-text via the browser's own engine. Recognition happens on the device, so a
 * spoken entry costs the server nothing — the server-side STT provider seam (Yandex
 * SpeechKit) is only needed for clients without this API.
 */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechRecognitionState {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/** `onResult` fires once per completed utterance — the caller decides what to do with it. */
export function useSpeechRecognition(
  onResult: (transcript: string) => void,
  lang = "ru-RU",
): SpeechRecognitionState {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref so a re-rendered callback never tears down the recognizer.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const best = event.results[0]?.[0]?.transcript ?? "";
      if (best) onResultRef.current(best);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed" ? "Нет доступа к микрофону" : "Не удалось распознать речь",
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      // start() throws if called while already running — harmless.
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
