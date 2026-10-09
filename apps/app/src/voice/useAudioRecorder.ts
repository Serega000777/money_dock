import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * One microphone stream for the whole app, kept alive across recordings instead of
 * calling track.stop() after every one — some WebViews (Telegram's iOS Mini App
 * included) re-confirm mic access on every fresh getUserMedia() call rather than
 * remembering a grant the way Safari does. Shared rather than per-screen: the home tab
 * stays mounted under the assistant, and a second live capture on iOS silences one of
 * the two, so the assistant's clips arrived empty and SpeechKit had nothing to hear.
 * Released when the last recorder unmounts.
 */
let sharedStream: MediaStream | null = null;
let mountedRecorders = 0;

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
  const startPendingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const startedAtRef = useRef(0);
  useEffect(() => {
    mountedRecorders += 1;
    return () => {
      mountedRecorders -= 1;
      if (mountedRecorders === 0) {
        sharedStream?.getTracks().forEach((track) => track.stop());
        sharedStream = null;
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (!supported || startPendingRef.current || recorderRef.current?.state === "recording") return;
    startPendingRef.current = true;
    stopRequestedRef.current = false;
    setError(null);
    // The permission prompt is part of the recording gesture on iOS. Reflect it at once,
    // otherwise the button looks dead while WebKit is waiting for the user to allow mic.
    setRecording(true);
    try {
      const reusable = sharedStream;
      const stream =
        reusable && reusable.getAudioTracks().some((track) => track.readyState === "live")
          ? reusable
          : await navigator.mediaDevices.getUserMedia({ audio: true });
      sharedStream = stream;
      startPendingRef.current = false;
      if (stopRequestedRef.current) {
        setRecording(false);
        setError("Разрешите микрофон, затем нажмите и удерживайте кнопку ещё раз");
        stopWaiterRef.current?.(null);
        stopWaiterRef.current = null;
        return;
      }
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
        // Stream stays live for the next recording — see sharedStream above.
        recorderRef.current = null;
        setRecording(false);
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
            : null;
        const longEnough = Date.now() - startedAtRef.current >= 350;
        if (!blob?.size || !longEnough) {
          setError("Удерживайте кнопку и произнесите операцию целиком");
        }
        // Blob size varies wildly between iOS versions/codecs; a fixed 3KB cutoff used
        // to silently discard perfectly audible short phrases. Duration is predictable.
        stopWaiterRef.current?.(blob?.size && longEnough ? blob : null);
        stopWaiterRef.current = null;
      };

      recorder.onerror = () => {
        recorderRef.current = null;
        setRecording(false);
        setError("Не удалось записать голос. Попробуйте ещё раз");
        stopWaiterRef.current?.(null);
        stopWaiterRef.current = null;
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      // A timeslice makes Safari flush chunks reliably; some iOS WebViews otherwise
      // produce no dataavailable event for a short recording stopped in one gesture.
      recorder.start(250);
      setRecording(true);
    } catch {
      startPendingRef.current = false;
      recorderRef.current = null;
      setRecording(false);
      setError("Нет доступа к микрофону");
      stopWaiterRef.current?.(null);
      stopWaiterRef.current = null;
    }
  }, [supported]);

  const stop = useCallback((): Promise<Blob | null> => {
    if (startPendingRef.current) {
      stopRequestedRef.current = true;
      setRecording(false);
      return new Promise((resolve) => {
        stopWaiterRef.current = resolve;
      });
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      stopWaiterRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return { supported, recording, error, start: () => void start(), stop };
}
