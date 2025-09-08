import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

let HAVE_OMNIZART = false;
try {
  // Attempt to detect omnizart availability (only valid in server/node runtime)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const omnizart = require('omnizart');
  HAVE_OMNIZART = !!omnizart;
} catch (e) {
  HAVE_OMNIZART = false;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const useOmnizart = (form.get('use_omnizart') as string) === 'true';
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    // If omnizart requested and available, attempt to run chord transcription server-side
    if (useOmnizart && HAVE_OMNIZART) {
      try {
        // Save file to disk (nextjs edge runtime uses nodejs here)
        const arrayBuffer = await file.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        const tmp = require('os').tmpdir();
        const path = require('path').join(tmp, `omnizart_upload_${Date.now()}.wav`);
        require('fs').writeFileSync(path, buf);

        // Use omnizart chord API
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { chord } = require('omnizart').app;
        const result = await chord.transcribe(path);

        // Convert to expected response shape
        const chords = (result?.chords || []).map((c: any) => ({ start: c.start, end: c.end, label: c.label }));
        return NextResponse.json({ text: '', segments: [], chords });
      } catch (e: any) {
        // Fall through to Whisper path on error
        console.error('Omnizart transcription failed:', e);
      }
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 400 });

    const body = new FormData();
    body.append("file", file, file.name);
    body.append("model", process.env.OPENAI_WHISPER_MODEL ?? "whisper-1");
    body.append("response_format", "verbose_json");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body,
    });

    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data?.error?.message || "transcribe failed" }, { status: 502 });

    return NextResponse.json({ text: data.text ?? "", segments: data.segments ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
