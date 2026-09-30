export type AssistantInputType = "text" | "voice";
export type AssistantActionStatus =
  | "pending"
  | "executing"
  | "completed"
  | "cancelled"
  | "failed"
  | "expired";

export interface AssistantConversation {
  id: string;
  title: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  inputType: AssistantInputType;
  content: string;
  createdAt: string;
}

export interface AssistantAction {
  id: string;
  tool: string;
  preview: Record<string, unknown>;
  status: AssistantActionStatus;
  expiresAt: string;
}

export interface AssistantResponse {
  message: AssistantMessage;
  action: AssistantAction | null;
}

export interface SpeechTranscriptionResult {
  text: string;
  provider: string;
  confidence?: number;
  durationMs?: number;
}

