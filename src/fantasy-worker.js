const REPO_BASE = "https://raw.githubusercontent.com/Beladiel/hof-card-scout/main/fantasy-draft-room";
const UPDATED_LABEL = "SEP. 5 RANKINGS · UPDATED 1:49 PM MDT";

function safeAssetPath(pathname) {
  let path = decodeURIComponent(pathname || "/");
  if (path === "/" || path === "/fantasy-draft-room" || path === "/fantasy-draft-room/") return "index.html";
  path = path.replace(/^\/fantasy-draft-room\/?/, "").replace(/^\/+/, "");
  if (!path || path.includes("..") || !/^[A-Za-z0-9._\/-]+$/.test(path)) return "";
  return path;
}

function contentType(path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const asset = safeAssetPath(url.pathname);
    if (!asset) return new Response("Not found", { status: 404 });

    const upstreamUrl = new URL(`${REPO_BASE}/${asset}`);
    upstreamUrl.searchParams.set("scout_refresh", Date.now().toString());

    let upstream;
    try {
      upstream = await fetch(upstreamUrl.toString(), {
        headers: { "User-Agent": "Scout-Lobstahs-Fantasy-Worker/2026" },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
    } catch (err) {
      return new Response("Scout could not load the fantasy app from GitHub.", { status: 502 });
    }
    if (!upstream.ok) return new Response("Fantasy app asset not found.", { status: upstream.status });

    const headers = new Headers();
    headers.set("Content-Type", contentType(asset));
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("X-Scout-Rankings", "2026-09-05T13:49:00-06:00");

    if (asset === "index.html") {
      let html = await upstream.text();
      html = html.replace("draft-updates-aug29.js?v=4.0", "draft-updates-aug29.js?v=sep5-1349");

      // Add an unmistakable ranking freshness badge directly above the title.
      const badge = `<div id="scoutRankingFreshness" style="display:inline-block;margin:6px 0 10px;padding:7px 10px;border-radius:999px;background:#e6bd63;color:#071c16;font-size:11px;font-weight:900;letter-spacing:.04em;box-shadow:0 0 0 1px rgba(255,255,255,.15) inset">✅ RANKINGS UPDATED SEP. 5, 2026 · 1:49 PM MDT</div>`;
      if (!html.includes("scoutRankingFreshness")) {
        html = html.replace('<h1 id="heroTitle">', `${badge}<h1 id="heroTitle">`);
      }

      return new Response(html, { status: 200, headers });
    }

    return new Response(upstream.body, { status: 200, headers });
  }
};
