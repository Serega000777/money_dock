export interface SpeechTranscriptionResult {
  text: string;
  provider: string;
  confidence?: number;
  durationMs?: number;
}

export interface SpeechToTextProvider {
  readonly name: string;
  transcribe(audio: Buffer, mimeType: string): Promise<SpeechTranscriptionResult>;
}

