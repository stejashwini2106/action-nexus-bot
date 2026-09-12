import { createServerFn } from "@tanstack/react-start";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const actionSchema = z.object({
  title: z.string(),
  detail: z.string(),
  owner: z.string(),
  priority: z.enum(["now", "soon", "later"]),
});

const bridgeResultSchema = z.object({
  urgency: z.enum(["critical", "high", "moderate", "low"]),
  urgencyLabel: z.string(),
  confidence: z.number(),
  summary: z.string(),
  facts: z.array(z.string()),
  nextActions: z.array(actionSchema),
  safety: z.array(z.string()),
  missing: z.array(z.string()),
  verification: z.array(z.string()),
});

const verificationSchema = z.object({
  status: z.enum(["checked", "needs_review", "safety_hold"]),
  confidence: z.number(),
  passed: z.array(z.string()),
  failed: z.array(z.string()),
  missingFields: z.array(z.string()),
});

export type BridgeScenario = "emergency" | "civic" | "accessibility";
export type BridgeResult = z.infer<typeof bridgeResultSchema> & { verification: z.infer<typeof verificationSchema> };
export type BridgeAnalysis = { extracted: z.infer<typeof bridgeResultSchema>; brief: BridgeResult };

type AnalyzeInput = {
  scenario: BridgeScenario;
  text: string;
  imageDataUrl: string | null;
};

function verifyBridgeResult(scenario: BridgeScenario, input: AnalyzeInput, extracted: z.infer<typeof bridgeResultSchema>): BridgeResult {
  const source = `${input.text} ${extracted.summary} ${extracted.facts.join(" ")}`.toLowerCase();
  const actions = extracted.nextActions.map((action) => `${action.title} ${action.detail}`).join(" ").toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];
  const missingFields = new Set(extracted.missing);
  let confidence = Math.max(0, Math.min(1, extracted.confidence));
  let safetyHold = false;
  const addCheck = (condition: boolean, pass: string, fail: string, missing?: string) => {
    if (condition) passed.push(pass);
    else {
      failed.push(fail);
      confidence -= 0.1;
      if (missing) missingFields.add(missing);
    }
  };

  if (scenario === "emergency") {
    const urgentSignal = /(chest|breath|breathing|unconscious|faint|stroke|seizure|bleeding|overdose|danger|fire|threat)/.test(source);
    const urgentAction = /(emergency service|911|112|999|ambulance|urgent|call for help)/.test(actions);
    const timing = /(minute|hour|today|yesterday|since|began|started|when)/.test(source);
    const location = /(location|address|street|home|room|near|at the|hospital)/.test(source);
    addCheck(!urgentSignal || urgentAction, "Urgent signals have a matching professional-help action", "Urgent signals lack a matching professional-help action", "Immediate help plan");
    addCheck(timing, "Timing context found", "Timing is not clear", "When it started");
    addCheck(location, "Location context found", "Location is not clear", "Current location");
    if (/(diagnos|prescrib|take .*medication|give .*medication)/.test(`${extracted.summary} ${actions}`)) {
      failed.push("Medical certainty or medication direction detected");
      confidence -= 0.25;
      safetyHold = true;
    } else passed.push("No diagnosis or medication instruction detected");
  }

  if (scenario === "civic") {
    addCheck(/(block|fallen|pothole|flood|smoke|wire|crash|collision|hazard|obstruction|traffic)/.test(source), "Hazard type identified", "Hazard type is not clear", "Hazard type");
    addCheck(/(location|address|street|intersection|near|library|road|lane|avenue)/.test(source), "Place or landmark identified", "Exact place is not clear", "Exact location or landmark");
    addCheck(/(traffic|people|pedestrian|cyclist|driver|public|risk|danger|blocked)/.test(source), "Who is at risk is identified", "People or traffic risk is not clear", "People affected or at risk");
    addCheck(/(report|311|public works|authorit|contact|call|warn)/.test(actions), "A safe reporting or warning action is present", "No safe reporting path is present", "Safe reporting channel");
    if (/(stand in traffic|enter traffic|touch live wire|move the tree|unstable branch)/.test(actions)) {
      failed.push("Action could expose someone to a hazard");
      confidence -= 0.25;
      safetyHold = true;
    }
  }

  if (scenario === "accessibility") {
    addCheck(/(need|cannot|can't|wheelchair|step-free|accessible|elevator|mobility|read|hear|sign language)/.test(source), "Access need preserved", "Access need is not clear", "Access need");
    addCheck(/(station|platform|building|entrance|room|airport|bus|train|location|at the)/.test(source), "Current place identified", "Current place is not clear", "Current place");
    addCheck(/(route|staff|assistance|help|elevator|accessible|step-free|platform)/.test(actions), "A route or assistance request is present", "No route or assistance step is present", "Accessible route or assistance");
    if (/(confirmed|available|working|will be there)/.test(`${extracted.summary} ${actions}`) && !/(asked|request|check|confirm)/.test(actions)) {
      failed.push("Availability was stated without a verification step");
      confidence -= 0.2;
      safetyHold = true;
    }
  }

  const finalConfidence = Math.max(0.05, Math.min(0.99, confidence));
  const status = safetyHold ? "safety_hold" : failed.length ? "needs_review" : "checked";
  return { ...extracted, verification: { status, confidence: finalConfidence, passed, failed, missingFields: [...missingFields] } };
}

export const analyzeBridgeInput = createServerFn({ method: "POST" })
  .inputValidator((input: AnalyzeInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Lovable AI is not configured for this workspace.");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3.8-flash");
    const scenarioBrief = {
      emergency: "urgent health or personal safety triage",
      civic: "a public incident that may need coordinated civic response",
      accessibility: "an accessibility barrier that needs practical, respectful support",
    }[data.scenario];

    const prompt = `You are BridgeOS, a safety-first universal bridge from messy human intent to clear next actions.
Analyze this input as ${scenarioBrief}.
Return a concise structured action brief. Do not diagnose, invent facts, or imply certainty.
Use plain language. Keep facts, safety guidance, and missing details short.
For emergency situations, prioritize contacting local emergency services when danger is immediate.
For medical concerns, state that a clinician or emergency service should make final decisions.
Set confidence from 0 to 1. Include 2 to 4 next actions, ordered by urgency.

Human input:
${data.text}
${data.imageDataUrl ? "A photo is attached. Use it as supporting context, but describe only visible evidence." : "No photo was attached."}`;

    const content = [
      { type: "text" as const, text: prompt },
      ...(data.imageDataUrl
        ? [{ type: "image" as const, image: data.imageDataUrl }]
        : []),
    ];

    try {
      const result = streamText({
        model,
        messages: [{ role: "user", content }],
        output: Output.object({ schema: bridgeResultSchema }),
      });
      const output = await result.output;
      return { extracted: output, brief: verifyBridgeResult(data.scenario, data, output) } satisfies BridgeAnalysis;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("BridgeOS received an incomplete action brief. Please try again with more detail.");
      }
      throw error;
    }
  });