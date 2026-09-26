import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

export interface AudioRecorderState {
  supported: boolean;
  recording: boolean;
  error: string | null;
  start: () => void;
  /** Resolves with the recorded clip, or null if nothing usable was captured (a press
   * released almost instantly is most likely an accidental tap, not real speech). */
  stop: () => Promise<Blob | null>;
}

function isSupported(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

/**
 * Records a short voice clip via the browser's own MediaRecorder — the fallback for
 * clients with no `SpeechRecognition` (every iOS browser, since WebKit has never
 * implemented it, Telegram's iOS Mini App WebView included). `useVoiceCapture`'s
 * `transcribe` mutation turns the resulting clip into the same kind of draft `parse`
 * already returns for browsers that can recognize speech client-side.
 */
export function useAudioRecorder(): AudioRecorderState {
  const [supported] = useState(isSupported);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopWaiterRef = useRef<((blob: Blob | null) => void) | null>(null);

  const start = useCallback(async () => {
    if (!supported) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        // Below ~3KB is essentially silence/noise from a held-then-immediately-released
        // tap — sending it would just spend a Gemini call for nothing.
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
            : null;
        stopWaiterRef.current?.(blob && blob.size > 3000 ? blob : null);
        stopWaiterRef.current = null;
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Нет доступа к микрофону");
    }
  }, [supported]);

  const stop = useCallback((): Promise<Blob | null> => {
    setRecording(false);
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      stopWaiterRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return { supported, recording, error, start: () => void start(), stop };
}
