import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const MAX_BYTES = 24 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return json({ error: "خدمة التفريغ غير مهيأة." }, 500);
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "طلب غير صالح." }, 400);
        }

        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return json({ error: "لا يوجد ملف صوتي." }, 400);
        }
        if (file.size > MAX_BYTES) {
          return json({ error: "الملف الصوتي كبير جداً — قسّم التسجيل." }, 400);
        }

        const language = String(form.get("language") ?? "").trim();

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", file, file.name || "recording.wav");
        if (language && /^[a-z]{2}$/.test(language)) upstream.append("language", language);

        const res = await fetch(GATEWAY, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const msg =
            res.status === 429
              ? "الخدمة مشغولة حالياً، أعد المحاولة بعد قليل."
              : res.status === 402
                ? "انتهى رصيد الذكاء الاصطناعي — يلزم تعبئته."
                : `تعذّر تفريغ الصوت (${res.status}).`;
          console.error(`transcribe failed [${res.status}]: ${body}`);
          return json({ error: msg }, res.status);
        }

        const data = (await res.json()) as { text?: string };
        return json({ text: data.text ?? "" }, 200);
      },
    },
  },
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
