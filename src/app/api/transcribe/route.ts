import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

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
