import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
} from "expo-audio";
import { useCallback, useRef, useState } from "react";

export interface AudioRecorderState {
  supported: boolean;
  recording: boolean;
  error: string | null;
  start: () => void;
  stop: () => Promise<Blob | null>;
}

/** Native counterpart of the browser MediaRecorder hook. The recording stays in Expo's
 * cache only long enough to turn it into the multipart Blob consumed by the API client. */
export function useAudioRecorder(): AudioRecorderState {
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const startedAtRef = useRef(0);

  const start = useCallback(async () => {
    if (recording || startingRef.current) return;
    startingRef.current = true;
    stopRequestedRef.current = false;
    setError(null);
    setRecording(true);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("permission");
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (stopRequestedRef.current) {
        setRecording(false);
        setError("Удерживайте кнопку и произнесите операцию целиком");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
    } catch {
      setRecording(false);
      setError("Нет доступа к микрофону");
    } finally {
      startingRef.current = false;
    }
  }, [recorder, recording]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (startingRef.current) {
      stopRequestedRef.current = true;
      setRecording(false);
      return null;
    }
    if (!recording) return null;
    try {
      await recorder.stop();
      setRecording(false);
      if (Date.now() - startedAtRef.current < 350 || !recorder.uri) {
        setError("Удерживайте кнопку и произнесите операцию целиком");
        return null;
      }
      const response = await fetch(recorder.uri);
      const source = await response.blob();
      const blob = source.type
        ? source
        : new Blob([await source.arrayBuffer()], { type: "audio/mp4" });
      if (!blob.size) throw new Error("empty recording");
      return blob;
    } catch {
      setRecording(false);
      setError("Не удалось записать голос. Попробуйте ещё раз");
      return null;
    }
  }, [recorder, recording]);

  return { supported: true, recording, error, start: () => void start(), stop };
}
