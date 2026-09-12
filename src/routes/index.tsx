import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Clipboard,
  FileImage,
  HeartPulse,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Siren,
  Sparkles,
  StopCircle,
  Trash2,
  TrafficCone,
  Upload,
  Volume2,
  WandSparkles,
  Waves,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeBridgeInput, type BridgeExtractedResult, type BridgeResult, type BridgeScenario } from "@/lib/bridgeos.functions";
import { clearBridgeAudit, makeAuditId, makeAuditPreview, readBridgeAudit, writeBridgeAudit, type BridgeAuditEntry } from "@/lib/bridgeos-audit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BridgeOS — Turn intent into safer action" },
      { name: "description", content: "A Gemini-powered bridge from messy human input to clear, verified action." },
      { property: "og:title", content: "BridgeOS — Turn intent into safer action" },
      { property: "og:description", content: "Turn voice, photos, and messy context into structured next steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type InputMode = "text" | "voice" | "photo";

const scenarioData: Record<BridgeScenario, {
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof HeartPulse;
  example: string;
  starter: string;
  color: string;
}> = {
  emergency: {
    label: "Emergency",
    eyebrow: "Personal safety",
    description: "Triage a messy moment into the safest next move.",
    icon: HeartPulse,
    example: "My father is dizzy, sweating, and says his chest feels heavy. He is awake but looks pale.",
    starter: "Describe what’s happening. Mention symptoms, timing, and anything that feels immediately dangerous.",
    color: "signal",
  },
  civic: {
    label: "Civic",
    eyebrow: "Community response",
    description: "Turn a public incident into coordinated, practical action.",
    icon: TrafficCone,
    example: "A fallen tree is blocking the eastbound bike lane near the library after the storm. Cars are swerving into traffic.",
    starter: "Describe the place, what changed, who is affected, and any immediate hazards.",
    color: "caution",
  },
  accessibility: {
    label: "Accessibility",
    eyebrow: "Everyday access",
    description: "Make an unfamiliar or difficult environment easier to navigate.",
    icon: Waves,
    example: "I’m at a train station. The elevator sign says out of order, the platform number is hard to see, and I need step-free access.",
    starter: "Tell us what you see, hear, need, or cannot safely do right now.",
    color: "accent",
  },
};

const demoResults: Record<BridgeScenario, BridgeResult> = {
  emergency: {
    urgency: "critical", urgencyLabel: "Act now", confidence: 0.94,
    summary: "Possible cardiac emergency: chest pressure with sweating, pallor, and dizziness needs immediate professional assessment.",
    facts: ["Chest feels heavy", "Dizziness and sweating", "Pale appearance", "Awake and responsive"],
    nextActions: [
      { title: "Call emergency services now", detail: "Put the call on speaker and describe the symptoms, timing, and location.", owner: "You", priority: "now" },
      { title: "Keep him still and supported", detail: "Have him sit or lie down. Do not let him drive or walk unassisted.", owner: "You", priority: "now" },
      { title: "Gather medication details", detail: "Prepare his medications, allergies, and ID for responders if safe to do so.", owner: "You", priority: "soon" },
    ],
    safety: ["Do not wait for symptoms to pass.", "Do not give food, drink, or someone else’s medication.", "This is not a diagnosis—emergency professionals must decide what happens next."],
    missing: ["When did the symptoms begin?", "Is there pain in the arm, jaw, back, or neck?"],
    verificationNotes: ["Urgency matched to symptom cluster", "Human review required", "Location not provided"],
    verification: { status: "needs_review", confidence: 0.82, passed: ["Urgent signals have a matching professional-help action", "No diagnosis or medication instruction detected"], failed: ["Timing is not clear", "Location is not clear"], missingFields: ["When it started", "Current location"] },
  },
  civic: {
    urgency: "high", urgencyLabel: "Coordinate soon", confidence: 0.9,
    summary: "A fallen tree is creating a collision risk by forcing bikes and cars into the same lane near a public destination.",
    facts: ["Eastbound bike lane blocked", "Near the library", "Drivers are swerving", "Storm-related obstruction"],
    nextActions: [
      { title: "Report the obstruction", detail: "Send the location and photo to the city’s 311 or public works channel.", owner: "Reporter", priority: "now" },
      { title: "Warn people at a safe distance", detail: "Use a visible, non-confrontational warning without entering traffic.", owner: "Nearby witness", priority: "now" },
      { title: "Add a precise landmark", detail: "Confirm the nearest intersection or library entrance so crews can find it quickly.", owner: "Reporter", priority: "soon" },
    ],
    safety: ["Do not stand in the roadway to direct traffic.", "Keep children and cyclists away from the obstruction.", "Avoid touching live wires or unstable branches."],
    missing: ["Exact intersection or nearest address", "Are power lines involved?"],
    verificationNotes: ["Hazard type identified from description", "Photo not provided", "Public works contact not confirmed"],
    verification: { status: "needs_review", confidence: 0.78, passed: ["Hazard type identified", "Place or landmark identified", "A safe reporting or warning action is present"], failed: ["Exact place is not clear"], missingFields: ["Exact intersection or nearest address"] },
  },
  accessibility: {
    urgency: "moderate", urgencyLabel: "Find an accessible route", confidence: 0.88,
    summary: "The primary step-free route is unavailable, and platform information is difficult to locate. Station staff can reroute you safely.",
    facts: ["Elevator marked out of order", "Platform signage hard to read", "Step-free access required", "User is at the station now"],
    nextActions: [
      { title: "Ask station staff for a step-free route", detail: "Show this brief or say: ‘I need the accessible route to my platform.’", owner: "You", priority: "now" },
      { title: "Confirm the platform number", detail: "Ask staff to write it down or read it aloud before moving.", owner: "You", priority: "soon" },
      { title: "Request travel assistance", detail: "Ask whether staff can escort you or arrange an alternative boarding point.", owner: "Station staff", priority: "soon" },
    ],
    safety: ["Do not use stairs if they are unsafe for you.", "Do not rely on a sign that is difficult to read—ask a person to confirm.", "Your access need is valid; you do not need to justify it."],
    missing: ["Station name and platform", "Whether staff are currently visible"],
    verificationNotes: ["Access need preserved", "Route availability not verified", "Human assistance recommended"],
    verification: { status: "needs_review", confidence: 0.8, passed: ["Access need preserved", "Current place identified", "A route or assistance request is present"], failed: ["Availability must be confirmed by staff"], missingFields: ["Station name and platform"] },
  },
};

function Index() {
  const [scenario, setScenario] = useState<BridgeScenario>("emergency");
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [mode, setMode] = useState<InputMode>("text");
  const [result, setResult] = useState<BridgeResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<"idle" | "transcribing" | "checking" | "building">("idle");
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<number[]>([]);
  const [auditEntries, setAuditEntries] = useState<BridgeAuditEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeScenario = scenarioData[scenario];
  const Icon = activeScenario.icon;
  const progress = result ? Math.round((completed.length / result.nextActions.length) * 100) : 0;

  useEffect(() => () => {
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    mediaRecorder.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => setAuditEntries(readBridgeAudit()), []);

  const contextLabel = useMemo(() => {
    if (mode === "voice") return isRecording ? `Listening · 00:${String(recordingSeconds).padStart(2, "0")}` : "Voice note ready";
    if (mode === "photo") return imageName || "Add a supporting photo";
    return "Text input";
  }, [imageName, isRecording, mode, recordingSeconds]);

  const reset = () => {
    setText(""); setImageDataUrl(null); setImageName(""); setResult(null); setError(""); setCompleted([]); setMode("text"); setProcessingStage("idle");
  };

  const selectScenario = (value: BridgeScenario) => {
    setScenario(value); setResult(null); setError(""); setCompleted([]); setText(""); setImageDataUrl(null); setImageName(""); setMode("text"); setProcessingStage("idle");
  };

  const saveAuditEntry = async (brief: BridgeResult, extracted: BridgeExtractedResult, input: { text: string; imageDataUrl: string | null; mode: InputMode; isExample: boolean }) => {
    const entry: BridgeAuditEntry = { id: makeAuditId(), createdAt: new Date().toISOString(), scenario, mode: input.mode, text: input.text, imageName, imagePreview: await makeAuditPreview(input.imageDataUrl), extracted, brief, isExample: input.isExample };
    if (writeBridgeAudit(entry)) setAuditEntries(readBridgeAudit());
  };

  const processInput = async (override?: { text: string; imageDataUrl: string | null; mode: InputMode; isExample: boolean }) => {
    const input = override ?? { text: text.trim(), imageDataUrl, mode, isExample: false };
    if (!input.text.trim() && !input.imageDataUrl) { setError("Add a note or supporting photo before processing."); return; }
    setIsProcessing(true); setProcessingStage("checking"); setError(""); setCompleted([]);
    try {
      setProcessingStage("building");
      const response = await analyzeBridgeInput({ data: { scenario, text: input.text.trim() || "Use the attached photo as the primary context.", imageDataUrl: input.imageDataUrl } });
      setResult(response.brief);
      await saveAuditEntry(response.brief, response.extracted, input);
    } catch (caught) {
      if (input.isExample) {
        const fallback = demoResults[scenario];
        setResult(fallback);
        await saveAuditEntry(fallback, fallback, input);
        setError("Live AI was unavailable, so BridgeOS loaded the verified demo brief.");
      } else setError(caught instanceof Error ? caught.message : "BridgeOS could not process that input.");
    } finally { setIsProcessing(false); setProcessingStage("idle"); }
  };

  const loadExample = () => {
    const example = activeScenario.example;
    setText(example); setResult(null); setError(""); setMode("text");
    void processInput({ text: example, imageDataUrl: null, mode: "text", isExample: true });
  };

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Keep images under 8 MB."); return; }
    const reader = new FileReader();
     reader.onload = () => {
       const dataUrl = String(reader.result);
       setImageDataUrl(dataUrl); setImageName(file.name); setMode("photo"); setError("");
       if (!text.trim()) void processInput({ text: "Use the attached photo as the primary context.", imageDataUrl: dataUrl, mode: "photo", isExample: false });
     };
    reader.readAsDataURL(file);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (isRecording) { stopRecording(); return; }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 2048) { setError("That recording was empty. Please try again."); return; }
        const form = new FormData(); form.append("file", blob, "bridgeos-recording.webm");
         setIsProcessing(true); setProcessingStage("transcribing");
        try {
          const response = await fetch("/api/transcribe", { method: "POST", body: form });
          const payload = await response.json() as { text?: string; error?: string };
          if (!response.ok) throw new Error(payload.error || "Voice processing failed.");
           const transcript = payload.text || "";
           setText(transcript); setMode("voice");
           await processInput({ text: transcript, imageDataUrl, mode: "voice", isExample: false });
        } catch (caught) { setError(caught instanceof Error ? caught.message : "Voice processing failed."); }
         finally { setIsProcessing(false); setProcessingStage("idle"); }
      };
      recorder.start(); mediaRecorder.current = recorder; setIsRecording(true); setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch { setError("Microphone access is needed to record a voice note."); }
  };

  const copyBrief = async () => {
     if (!result) return;
    const brief = `${result.summary}\n\nNext actions:\n${result.nextActions.map((action, index) => `${index + 1}. ${action.title} — ${action.detail}`).join("\n")}`;
    await navigator.clipboard?.writeText(brief);
  };

  const restoreAuditEntry = (entry: BridgeAuditEntry) => {
    setScenario(entry.scenario); setText(entry.text); setMode(entry.mode); setImageName(entry.imageName); setImageDataUrl(entry.imagePreview); setResult(entry.brief); setCompleted([]); setError("");
  };

  const clearHistory = () => {
    if (!window.confirm("Clear all saved review entries?")) return;
    clearBridgeAudit(); setAuditEntries([]);
  };

  const shareBrief = async () => {
    if (!result) return;
    const brief = `${result.urgencyLabel}: ${result.summary}`;
    if (navigator.share) await navigator.share({ title: "BridgeOS action brief", text: brief });
    else await copyBrief();
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="paper-grid fixed inset-0 -z-0 opacity-60" />
      <div className="relative z-10 mx-auto max-w-[1500px] px-5 pb-12 pt-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-border/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><WandSparkles className="size-4" /></div>
            <div><div className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">BridgeOS / 01</div><div className="font-semibold tracking-tight">Human intent → safer action</div></div>
          </div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:flex"><span className="pulse-dot size-2 rounded-full bg-signal" /> Gemini-powered bridge online</div><Button variant="outline" size="sm" onClick={reset}><RotateCcw className="size-3.5" /> New brief</Button></div>
        </header>

        <section className="grid gap-8 pb-10 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-16 lg:pt-16">
          <div>
            <div className="mb-5 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-signal"><span className="size-1.5 rounded-full bg-signal" /> Intent compiler for high-stakes moments</div>
            <h1 className="max-w-3xl text-[clamp(2.9rem,6vw,6.2rem)] font-semibold leading-[0.94] tracking-[-0.07em]">Say it.<br /><span className="text-primary/75">Show it.</span><br />We’ll make the<br /><em className="font-serif font-normal tracking-[-0.08em] text-signal">next step clear.</em></h1>
          </div>
          <div className="max-w-lg pb-1 lg:pb-3"><p className="text-lg leading-relaxed text-ink-soft">BridgeOS turns voice, photos, and messy real-world context into a structured, verified action brief—so people can move from overwhelmed to oriented.</p><div className="mt-6 flex flex-wrap gap-2"><Badge variant="outline" className="bg-paper/70 font-mono text-[10px] uppercase tracking-wider"><ShieldCheck className="mr-1 size-3 text-signal" /> Safety-first</Badge><Badge variant="outline" className="bg-paper/70 font-mono text-[10px] uppercase tracking-wider"><Sparkles className="mr-1 size-3 text-primary" /> Gemini multimodal</Badge><Badge variant="outline" className="bg-paper/70 font-mono text-[10px] uppercase tracking-wider"><ArrowUpRight className="mr-1 size-3" /> Human reviewed</Badge></div></div>
        </section>

        <section className="grid gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
          <div className="min-w-0 border-t border-border pt-5">
            <div className="mb-6 flex items-center justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">01 / Input</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">What’s happening?</h2></div><div className="font-mono text-xs text-muted-foreground">{contextLabel}</div></div>
            <div className="mb-4 grid grid-cols-3 gap-1 border-b border-border">
              {(Object.keys(scenarioData) as BridgeScenario[]).map((value) => { const data = scenarioData[value]; const ScenarioIcon = data.icon; return <button key={value} onClick={() => selectScenario(value)} className={`group flex items-center gap-2 border-b-2 px-2 py-3 text-left text-sm font-medium transition-colors ${scenario === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><ScenarioIcon className="size-4" /><span>{data.label}</span></button>; })}
            </div>
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-border bg-paper/75 p-4"><div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="size-4" /></div><div><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{activeScenario.eyebrow}</div><p className="mt-1 text-sm leading-relaxed text-ink-soft">{activeScenario.description}</p></div></div>
            <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-paper shadow-[0_18px_50px_oklch(0.3_0.05_240_/_0.07)]">
              {isProcessing && <div className="scan-line absolute left-0 right-0 top-0 z-10 h-px bg-signal shadow-[0_0_20px_4px_oklch(0.62_0.16_35_/_0.35)]" />}
              <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" /> Live context</div><div className="font-mono text-[10px] text-muted-foreground">{text.length}/1200</div></div>
              <Textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 1200))} placeholder={activeScenario.starter} className="min-h-[190px] resize-none rounded-none border-0 bg-transparent px-4 py-4 text-base leading-relaxed shadow-none focus-visible:ring-0" />
              {imageDataUrl && <div className="mx-4 mb-3 flex items-center gap-3 rounded-md border border-border bg-background/60 p-2"><img src={imageDataUrl} alt="Supporting context" className="size-12 rounded object-cover" /><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{imageName}</div><div className="font-mono text-[10px] text-muted-foreground">Photo attached for context</div></div><Button variant="ghost" size="icon" aria-label="Remove photo" onClick={() => { setImageDataUrl(null); setImageName(""); }}><Check className="size-4 rotate-45" /></Button></div>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"><div className="flex items-center gap-1"><Button variant={mode === "voice" ? "secondary" : "ghost"} size="sm" onClick={startRecording}>{isRecording ? <StopCircle className="size-4 text-signal" /> : <Mic className="size-4" />}{isRecording ? "Stop" : "Voice"}</Button><label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"><ImagePlus className="size-4" /> Photo<input type="file" accept="image/*" className="sr-only" onChange={handlePhoto} /></label><Button variant="ghost" size="sm" onClick={loadExample}><Play className="size-3.5" /> Try example</Button></div><Button onClick={() => void processInput()} disabled={isProcessing} size="lg" className="w-full sm:w-auto">{isProcessing ? <><Loader2 className="size-4 animate-spin" /> {processingStage === "transcribing" ? "Transcribing…" : processingStage === "checking" ? "Checking safety…" : "Building brief…"}</> : <><Sparkles className="size-4" /> Build action brief</>}</Button></div>
            </div>
            {isRecording && <div className="mt-3 flex items-center gap-2 font-mono text-xs text-signal"><span className="pulse-dot size-2 rounded-full bg-signal" /> Recording your complete voice note · 00:{String(recordingSeconds).padStart(2, "0")}</div>}
            {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
            <div className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-signal" /><span>BridgeOS supports decisions; it does not replace emergency services, medical professionals, or local authorities.</span></div>
          </div>

          <div className="min-w-0 border-t border-border pt-5">
            <div className="mb-6 flex items-center justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">02 / Output</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">Action brief</h2></div>{result && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Copy brief" onClick={copyBrief}><Clipboard className="size-4" /></Button><Button variant="ghost" size="icon" aria-label="Share brief" onClick={shareBrief}><Share2 className="size-4" /></Button></div>}</div>
            {!result ? <EmptyBrief scenario={scenario} onExample={loadExample} /> : <ActionBrief result={result} completed={completed} progress={progress} onToggle={(index) => setCompleted((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} />}
          </div>
         </section>
         <AuditLog entries={auditEntries} onRestore={restoreAuditEntry} onClear={clearHistory} />

        <footer className="mt-12 flex flex-col gap-3 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>BridgeOS / A universal bridge for human intent</span><span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-signal" /> Built for moments that matter</span></footer>
      </div>
    </main>
  );
}

function EmptyBrief({ scenario, onExample }: { scenario: BridgeScenario; onExample: () => void }) {
  const data = scenarioData[scenario];
  return <div className="flex min-h-[440px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-paper/45 px-8 text-center"><div className="relative mb-6 flex size-20 items-center justify-center rounded-full border border-border bg-background"><div className="absolute inset-3 rounded-full border border-dashed border-primary/25" /><Siren className="size-7 text-primary/65" /></div><h3 className="text-xl font-semibold tracking-tight">Your brief will land here.</h3><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Add a note, photo, or voice message. BridgeOS will separate the signal from the noise and show the safest next steps.</p><Button variant="outline" size="sm" className="mt-6" onClick={onExample}><Play className="size-3.5" /> Load {data.label.toLowerCase()} example</Button></div>;
}

function ActionBrief({ result, completed, progress, onToggle }: { result: BridgeResult; completed: number[]; progress: number; onToggle: (index: number) => void }) {
  const urgencyClass = result.urgency === "critical" ? "bg-signal/15 text-signal-foreground border-signal/35" : result.urgency === "high" ? "bg-caution/30 text-caution-foreground border-caution/50" : "bg-accent text-accent-foreground border-accent";
  return <div className="space-y-4">
    <div className={`rounded-lg border p-5 ${urgencyClass}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em]"><span className="size-2 rounded-full bg-current" /> {result.urgencyLabel}</div><div className="font-mono text-[10px] uppercase tracking-wider">{Math.round(result.confidence * 100)}% signal confidence</div></div><p className="mt-4 max-w-2xl text-lg font-medium leading-relaxed">{result.summary}</p></div>
     <div className="grid gap-4 sm:grid-cols-2"><BriefSection title="What we heard" icon={<Volume2 className="size-4" />}><div className="flex flex-wrap gap-2">{result.facts.map((fact) => <Badge key={fact} variant="outline" className="bg-background/55 text-xs font-normal">{fact}</Badge>)}</div></BriefSection><BriefSection title="Verification notes" icon={<ShieldCheck className="size-4" />}><ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">{result.verificationNotes.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-signal" />{item}</li>)}</ul></BriefSection></div>
     <VerificationPanel verification={result.verification} />
    <div className="rounded-lg border border-border bg-paper p-5"><div className="mb-4 flex items-center justify-between"><div><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Recommended sequence</div><h3 className="mt-1 font-semibold">Next actions</h3></div><div className="text-right"><div className="font-mono text-xs text-primary">{progress}% complete</div><div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div></div></div><div className="space-y-2">{result.nextActions.map((action, index) => <button key={action.title} onClick={() => onToggle(index)} className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-all hover:border-primary/40 ${completed.includes(index) ? "border-signal/40 bg-signal/5" : "border-border bg-background/45"}`}><span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${completed.includes(index) ? "border-signal bg-signal text-signal-foreground" : "border-border"}`}>{completed.includes(index) ? <Check className="size-3" /> : <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>}</span><span className="min-w-0 flex-1"><span className={`block text-sm font-medium ${completed.includes(index) ? "line-through opacity-60" : ""}`}>{action.title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{action.detail}</span><span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-primary/70">{action.owner} · {action.priority}</span></span><ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" /></button>)}</div></div>
    <div className="grid gap-4 sm:grid-cols-2"><BriefSection title="Safety check" icon={<AlertTriangle className="size-4 text-signal" />} tone="signal"><ul className="space-y-2 text-xs leading-relaxed text-ink-soft">{result.safety.map((item) => <li key={item} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-signal" />{item}</li>)}</ul></BriefSection><BriefSection title="Still unclear" icon={<FileImage className="size-4" />}><ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">{result.missing.map((item) => <li key={item} className="flex gap-2"><span className="font-mono text-primary">?</span>{item}</li>)}</ul></BriefSection></div>
    <div className="flex items-center gap-2 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-signal" /> This brief is an aid for human judgment. Verify important details before acting.</div>
  </div>;
}

function VerificationPanel({ verification }: { verification: BridgeResult["verification"] }) {
  const statusLabel = verification.status === "checked" ? "Checked" : verification.status === "needs_review" ? "Needs review" : "Safety hold";
  const statusClass = verification.status === "checked" ? "border-signal/30 bg-signal/5" : verification.status === "needs_review" ? "border-caution/50 bg-caution/10" : "border-destructive/35 bg-destructive/5";
  return <div className={`rounded-lg border p-5 ${statusClass}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><ShieldCheck className="size-4" /> Ruleset verification</div><h3 className="mt-2 text-lg font-semibold">{statusLabel}</h3></div><div className="text-right"><div className="font-mono text-xl font-medium text-primary">{Math.round(verification.confidence * 100)}%</div><div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">verified confidence</div></div></div><div className="mt-4 grid gap-4 text-xs sm:grid-cols-2"><div><div className="mb-2 font-mono uppercase tracking-wider text-muted-foreground">Passed checks</div><ul className="space-y-1.5">{verification.passed.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-signal" />{item}</li>)}</ul></div><div><div className="mb-2 font-mono uppercase tracking-wider text-muted-foreground">Review flags</div><ul className="space-y-1.5">{(verification.failed.length ? verification.failed : ["No blocking rule failures"]).map((item) => <li key={item} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-signal" />{item}</li>)}</ul></div></div><div className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">{verification.missingFields.length ? `Missing or unresolved: ${verification.missingFields.join(" · ")}` : "Required context was present for this pass."} Human review remains required before important action.</div></div>;
}

function AuditLog({ entries, onRestore, onClear }: { entries: BridgeAuditEntry[]; onRestore: (entry: BridgeAuditEntry) => void; onClear: () => void }) {
  return <section className="mt-12 border-t border-border pt-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">03 / Review</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">Audit log</h2><p className="mt-1 text-sm text-muted-foreground">Recent inputs and verified briefs stay available for the demo.</p></div>{entries.length > 0 && <Button variant="outline" size="sm" onClick={onClear}><Trash2 className="size-3.5" /> Clear history</Button>}</div>{entries.length === 0 ? <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-paper/45 p-4 text-sm text-muted-foreground"><Clock3 className="size-4" /> Completed briefs will appear here for later review.</div> : <div className="space-y-2">{entries.map((entry) => <button key={entry.id} onClick={() => onRestore(entry)} className="flex w-full items-start gap-3 rounded-lg border border-border bg-paper p-3 text-left transition-colors hover:border-primary/45"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><HistoryIcon scenario={entry.scenario} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-xs font-medium"><span>{scenarioData[entry.scenario].label}</span><Badge variant="outline" className="font-mono text-[9px] uppercase">{entry.mode}</Badge><Badge variant="outline" className="font-mono text-[9px] uppercase">{entry.brief.verification.status.replace("_", " ")}</Badge>{entry.isExample && <span className="font-mono text-[9px] uppercase text-muted-foreground">demo example</span>}</div><p className="mt-1 truncate text-sm text-muted-foreground">{entry.brief.summary}</p></div><div className="shrink-0 text-right font-mono text-[10px] text-muted-foreground">{Math.round(entry.brief.verification.confidence * 100)}%<br />{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></button>)}</div>}</section>;
}

function HistoryIcon({ scenario }: { scenario: BridgeScenario }) {
  const Icon = scenarioData[scenario].icon;
  return <Icon className="size-4" />;
}

function BriefSection({ title, icon, children, tone }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: "signal" }) {
  return <div className={`rounded-lg border p-4 ${tone === "signal" ? "border-signal/25 bg-signal/5" : "border-border bg-paper"}`}><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{title}</div>{children}</div>;
}