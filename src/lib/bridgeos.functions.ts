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

export type BridgeScenario = "emergency" | "civic" | "accessibility";
export type BridgeResult = z.infer<typeof bridgeResultSchema>;

type AnalyzeInput = {
  scenario: BridgeScenario;
  text: string;
  imageDataUrl: string | null;
};

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
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("BridgeOS received an incomplete action brief. Please try again with more detail.");
      }
      throw error;
    }
  });