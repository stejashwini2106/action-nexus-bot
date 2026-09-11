# BridgeOS: a universal intent-to-action demo

## Product direction

Build a polished, single-screen hackathon demo called **BridgeOS**. It accepts messy human input across three high-impact scenarios—emergency triage, civic incident response, and accessibility support—and turns it into a structured, verified action brief.

The demo should make one promise visible immediately: **“Say it. Show it. We’ll make the next step clear.”** It will feel like an operational tool, not a marketing page.

## Judge-facing experience

1. Start with a scenario selector: **Emergency**, **Civic**, or **Accessibility**.
2. Let the user provide intent by typing, recording a voice note, or adding a photo.
3. Include one-click example inputs so the complete demo works without permissions or external data.
4. Process the input into a structured result with:
   - urgency and confidence
   - concise situation summary
   - extracted facts and missing details
   - recommended next actions
   - safety guardrails / “do not do” guidance
   - sources or verification notes
5. Make the result editable and actionable: copy/share the brief, mark steps complete, and reset for another scenario.
6. Show a clear disclaimer for emergency and medical scenarios: the app supports decision-making and does not replace emergency services or clinicians.

## Milestones

### 1. Foundation and visual system
- Replace the blank home route with the BridgeOS workspace.
- Establish a distinctive calm emergency-operations visual language: warm paper background, ink typography, signal colors for urgency, and restrained motion.
- Add semantic page metadata and preserve the existing TanStack Start shell.
- Use accessible controls, keyboard focus states, responsive layout, and mobile-friendly stacking.

### 2. Input workspace
- Build scenario tabs and a prominent input composer.
- Add text entry, photo attachment preview, and voice recording controls.
- Add guided example prompts tailored to each scenario.
- Handle permission denial, empty input, invalid files, and reset states visibly.

### 3. AI transformation
- Add a server-side AI boundary so keys and prompts remain private.
- Send the normalized input to Lovable AI Gateway with a strict structured result shape.
- Use Gemini transcription for voice input and support photo context in the analysis flow.
- Surface gateway errors directly with clear recovery copy; do not fake successful AI output.
- Keep demo examples available as a deterministic fallback only when the user explicitly selects a built-in example, so judges can complete the flow reliably.

### 4. Verified action brief
- Render the result as a scannable brief rather than a chat transcript.
- Separate “What we heard,” “What matters now,” “Next actions,” and “Safety check.”
- Add confidence, verification status, timestamp, and a visible list of unresolved questions.
- Make action rows interactive with completion state and copy/share controls.

### 5. Demo polish and QA
- Test all three scenarios, example flows, reset behavior, file handling, voice permission failure, and AI error states.
- Check desktop and narrow mobile layouts for clipping, overlap, readable text, and usable controls.
- Verify the live AI path with a real request and confirm errors are visible rather than swallowed.
- Prepare a concise demo narrative: messy input → structured truth → safer action → measurable human benefit.

## Technical approach

- Keep the app on the existing TanStack Start + React + Tailwind stack.
- Create a client-safe server-function module for analysis and a server-side helper for gateway configuration.
- Use the existing UI primitives and semantic design tokens; avoid raw colors in feature code.
- Use browser APIs for local voice capture and file previews, then send complete audio files to the server for transcription.
- Prefer a compact structured response over open-ended chat so the result is predictable, judge-friendly, and easy to verify.
- Avoid persistence and login for the first submission; the winning demo loop should be immediate and frictionless.

## Submission strategy

Frame the app as a reusable “intent compiler” for high-stakes situations, not three unrelated tools. Demo one emergency input end-to-end, then switch scenarios to prove the same bridge adapts to civic and accessibility needs. Emphasize safety, uncertainty, human review, and the reduction of cognitive load—not just model output.

## Open assumptions

- No official rubric, deadline, or submission requirements were provided, so the plan optimizes for visible impact, completeness, reliability, and a strong live demo.
- The first build will use built-in examples to guarantee a compelling presentation even when microphone, camera, or network permissions are unavailable.
