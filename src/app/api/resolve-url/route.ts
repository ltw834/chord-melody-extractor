import { NextRequest, NextResponse } from "next/server";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;
const SC_RE = /soundcloud\.com\/[\w-]+\/[\w-]+/i;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return json({ error: "url required" }, 400);

    // YouTube: default to EMBED; if ENABLE_SERVER_YOUTUBE=true, return server stream
    if (YT_RE.test(url)) {
      const id = (url.match(YT_RE)![1]);
      const allowServer = String(process.env.ENABLE_SERVER_YOUTUBE || '').toLowerCase() === 'true';
      if (!allowServer) {
        const embed = `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${encodeURIComponent(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000")}`;
        return json({ kind: "youtube_embed", embedUrl: embed });
      }
      // Server-side: extract audio stream URL
      const { default: ytdl } = await import('ytdl-core');
      const info = await ytdl.getInfo(id);
      // Pick an audio-only format (m4a/webm) with highest abr
      const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
      if (!format || !format.url) return json({ error: 'no audio format' }, 404);
      return json({ kind: 'youtube_server', streamUrl: format.url, title: info.videoDetails.title });
    }

    // SoundCloud: resolve stream URL using client id (server-side)
    if (SC_RE.test(url)) {
      const cid = process.env.SOUNDCLOUD_CLIENT_ID;
      if (!cid) return json({ error: "SOUNDCLOUD_CLIENT_ID missing" }, 400);

      // Resolve track → stream URL
      const resolve = new URL("https://api-widget.soundcloud.com/resolve");
      resolve.searchParams.set("url", url);
      resolve.searchParams.set("format", "json");
      resolve.searchParams.set("client_id", cid);

      const r = await fetch(resolve.toString());
      if (!r.ok) return json({ error: "soundcloud resolve failed" }, 502);
      const meta = await r.json();

      // Prefer progressive stream if available
      const prog = (meta?.media?.transcodings ?? []).find((t: any) =>
        t.format?.protocol === "progressive"
      );
      if (!prog) return json({ error: "no progressive stream" }, 404);

      const streamR = await fetch(`${prog.url}?client_id=${cid}`);
      if (!streamR.ok) return json({ error: "stream url fetch failed" }, 502);
      const streamMeta = await streamR.json();

      return json({ kind: "soundcloud", streamUrl: streamMeta.url, title: meta?.title ?? "" });
    }

    return json({ error: "unsupported url" }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
}
