import { createFileRoute } from "@tanstack/react-router";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const MAX_BYTES = 24 * 1024 * 1024;

const BASE =
  "تفريغ حرفي دقيق للكلام كما نُطق تماماً بالحروف العربية، مع الحفاظ على الكلمات العامية وعدم تحويلها إلى الفصحى، وإضافة علامات الترقيم. الكلمات الإنجليزية تُكتب بحروفها الإنجليزية.";

const DIALECT_PROMPTS: Record<"auto" | "sa" | "eg", string> = {
  sa: `${BASE} المتحدث سعودي (نجدي/حجازي/شرقي). أمثلة على مفردات متوقعة: وش، ايش، ليش، وشلون، كيفك، زين، مرة، يبغى، ابغى، ودّي، أبي، تبي، الحين، ذحين، بعدين، يالله، هاه، عاد، خلاص، مو، ماهو، حيل، واجد، سالفة، طقطقة، يعطيك العافية، ما عليك، زحمة، دوام، مشوار، فلوس، قروب، اجتماع، محاضرة.`,
  eg: `${BASE} المتحدث مصري. أمثلة على مفردات متوقعة: إزيك، عامل إيه، إيه ده، ليه، إزاي، فين، إمتى، دلوقتي، بكرة، كده، كمان، أوي، خالص، عايز، عاوز، مش، مفيش، ماشي، طيب، يلا، بقى، يعني، برضه، حاجة، حلو، جامد، بتاع، ده، دي، دول، اللي، هنعمل، هيروح، بيقول، المحاضرة، الاجتماع.`,
  auto: `${BASE} قد يكون المتحدث سعودياً أو مصرياً أو يتكلم الفصحى. أمثلة على مفردات متوقعة: وش، ايش، ليش، أبغى، الحين، زين، مرة، مو، إزيك، عايز، دلوقتي، كده، أوي، مش، مفيش، بتاع، اللي، يعني، طيب، خلاص، المحاضرة، الاجتماع.`,
};

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return json({ error: "خدمة التفريغ غير مهيأة." }, 500);
        }

        // Require a signed-in user: verify the Supabase bearer token.
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return json({ error: "يلزم تسجيل الدخول." }, 401);
        const supabaseUrl = process.env["VITE_SUPABASE_URL"];
        const anonKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !anonKey) return json({ error: "خدمة التفريغ غير مهيأة." }, 500);
        const whoami = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
        }).catch(() => null);
        if (!whoami?.ok) return json({ error: "انتهت الجلسة — سجّل الدخول مجدداً." }, 401);

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
        const dialectRaw = String(form.get("dialect") ?? "auto");
        const dialect = dialectRaw === "sa" || dialectRaw === "eg" ? dialectRaw : "auto";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", file, file.name || "recording.wav");
        if (language && /^[a-z]{2}$/.test(language)) upstream.append("language", language);
        upstream.append("prompt", DIALECT_PROMPTS[dialect]);
        upstream.append("temperature", "0");

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
