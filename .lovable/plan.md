# BridgeOS: verified multimodal action briefs and audit review

## Goal

Finish the BridgeOS demo loop so a judge can choose Emergency, Civic, or Accessibility, provide text, voice, or a photo, and receive a structured brief that has been checked against explicit safety rules. Save each completed run for quick review during the demo.

## Current state confirmed

- The home screen already has the three scenario tabs, text input, browser voice recording, photo attachment, structured output, example data, and action completion controls.
- Voice currently stops after transcription and puts the transcript into the composer; it does not automatically build the brief.
- The AI function currently returns model-generated fields but has no deterministic verification pass.
- There is no audit-log table or existing persistence layer in the project. The original product direction intentionally avoids login and persistence for a frictionless demo.

## User-facing experience

1. Keep the scenario selector as the primary control, with the selected scenario visibly driving its description, example, input guidance, safety language, and output label.
2. Make each modality complete the same pipeline:
   - Text: enter or load an example, then build the brief.
   - Voice: record, stop, transcribe, and automatically continue into brief generation once a transcript is available.
   - Photo: attach a valid image and automatically continue into brief generation when there is no additional text; if text is present, use the same single Build action to combine both.
3. Show one clear processing state with stages such as “Transcribing”, “Checking safety rules”, and “Building brief”, and preserve useful error messages without replacing them with a generic success state.
4. Add a verification block to every result showing:
   - overall verification status: Checked, Needs review, or Safety hold;
   - verified confidence score separate from the model’s raw signal confidence;
   - passed and failed rule checks;
   - missing fields/questions that lowered confidence;
   - a visible human-review reminder for all emergency and medical outputs.
5. Add an Audit log / Review area on the same screen. Each completed run is a compact, timestamped row with scenario, modality, urgency, verification status, confidence, and summary. Selecting a row restores its saved input and action brief for review without starting a new AI request. Include a clear “Clear history” action with confirmation.

## Verification and server behavior

- Extend the shared BridgeOS result schema with structured verification data rather than storing verification as untyped strings.
- Add a server-side deterministic ruleset that runs after Gemini returns and before the result reaches the browser. It must never rely on browser state or editable storage.
- Apply scenario-specific checks:
  - Emergency: immediate-danger language must produce an urgent professional-help action; timing, location, and key symptom context must be identified or listed as missing; the result must not claim a diagnosis or prescribe medication.
  - Civic: hazard type, location, people/traffic risk, and a safe reporting path must be present or marked missing; guidance must not direct anyone into traffic or unstable hazards.
  - Accessibility: the person’s access need, current place, and route/assistance need must be preserved or marked missing; the result must not claim a route, elevator, or staff availability was confirmed without evidence.
- Normalize confidence to a safe range, lower it when required checks fail, derive missing fields from absent or uncertain content, and set the verification status from rule outcomes. The verifier may downgrade an unsafe model result but must not invent facts.
- Keep the raw model result and the verified final brief distinct in the server flow so the audit entry can show what was extracted and what was approved for display.
- Update voice processing to use the gateway’s expected server-side authentication/header contract, preserve the uploaded MIME type, and return the gateway’s actual error message/status so terminal failures stop visibly while transient failures can be retried deliberately.

## Audit storage

- Use a small browser-local audit store for this no-login hackathon demo, keeping the experience immediate and avoiding a public medical-data table.
- Persist a bounded list of recent entries containing: timestamp, scenario, input mode, text/transcript, photo filename plus a compressed preview when available, raw extracted structured fields, verified action brief, and verification outcome.
- Cap entry count and preview size, handle unavailable or full browser storage gracefully, and never let audit persistence block a successful brief.
- Mark example runs separately from live AI runs so judges can understand which path they are reviewing.

## Implementation sequence

1. Define the verification result types, rules, normalization helpers, and safe fallback behavior in the server-side BridgeOS function.
2. Update the voice endpoint and client orchestration so transcription flows directly into analysis, while photo selection and combined text/photo inputs use the same processing function.
3. Add the verification panel and clear processing/error states to the action-brief view.
4. Add the browser-local audit store and review controls, wiring every successful verified result—including built-in examples—into the log.
5. Refine scenario switching so it clears only the active working draft when appropriate, preserves the audit history, and restores selected historical briefs without mixing scenarios.
6. Validate the three built-in examples, text/photo flow, voice flow, missing-field downgrades, safety holds, reset behavior, audit restore/clear behavior, and narrow-screen layout. Make one real AI request through the updated path when workspace credits are available; otherwise verify the deterministic examples and surface the unavailable-AI state honestly.

## Technical details

- Keep TanStack Start server functions for app-internal analysis and the existing API route for audio upload.
- Keep all rules, prompts, model configuration, and gateway keys server-side.
- Do not add authentication or a shared public database for the audit log in this milestone.
- Use existing semantic design tokens and UI primitives; do not introduce raw visual colors or a second visual system.
- Preserve route metadata and the current single-screen workflow.