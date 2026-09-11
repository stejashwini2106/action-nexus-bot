import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const audio = form.get("file");

        if (!(audio instanceof File) || audio.size < 2048) {
          return Response.json({ error: "That recording was empty. Please try again." }, { status: 400 });
        }
        if (audio.size > 14 * 1024 * 1024) {
          return Response.json({ error: "That recording is too large. Keep it under 14 MB." }, { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "Voice processing is not configured for this workspace." }, { status: 503 });
        }

        const upstream = new FormData();
        const extension = audio.type.includes("mp4") ? "mp4" : audio.type.includes("wav") ? "wav" : "webm";
        upstream.append("model", "google/gemini-3.5-transcribe");
        upstream.append("file", audio, `bridgeos-recording.${extension}`);

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });

        if (!response.ok) {
          const message = await response.text();
          return Response.json({ error: message || "Voice processing failed." }, { status: response.status });
        }

        const payload = (await response.json()) as { text?: string };
        return Response.json({ text: payload.text ?? "" });
      },
    },
  },
});