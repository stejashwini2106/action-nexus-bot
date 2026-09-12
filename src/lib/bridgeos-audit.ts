import type { BridgeExtractedResult, BridgeResult, BridgeScenario } from "./bridgeos.functions";

const STORAGE_KEY = "bridgeos-audit-log";
const MAX_ENTRIES = 12;

export type BridgeAuditEntry = {
  id: string;
  createdAt: string;
  scenario: BridgeScenario;
  mode: "text" | "voice" | "photo";
  text: string;
  imageName: string;
  imagePreview: string | null;
  extracted: BridgeExtractedResult;
  brief: BridgeResult;
  isExample: boolean;
};

export function readBridgeAudit(): BridgeAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as BridgeAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeBridgeAudit(entry: BridgeAuditEntry): boolean {
  if (typeof window === "undefined") return false;
  try {
    const entries = [entry, ...readBridgeAudit()].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function clearBridgeAudit(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Review history is best-effort and should never block the brief.
  }
}

export function makeAuditId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function makeAuditPreview(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl || typeof window === "undefined") return null;
  try {
    const image = new Image();
    image.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not preview image"));
    });
    const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.65);
  } catch {
    return null;
  }
}