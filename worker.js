export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    /**
     * Redirect root path to project repository.
     */
    if (path === "/" || path === "/index") {
      return Response.redirect(
        "https://github.com/xsyanic/mcskins-api",
        302
      );
    }

    /**
     * Route pattern:
     * /skin/<player>
     * /skin/<player>.png
     * /skin/minecraft/<player>.png
     * /skin/tlauncher/<player>.png
     * /skin/elyby/<player>.png
     */
    const match = path.match(
      /^\/skin(?:\/(minecraft|tlauncher|elyby))?\/([^\/]+?)(?:\.png)?$/
    );

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    const source = match[1] || "minecraft";
    const player = match[2];

    /**
     * Upstream URL selection.
     */
    let upstream;
    switch (source) {
      case "minecraft":
        upstream = `https://minotar.net/skin/${player}`;
        break;
      case "tlauncher":
        upstream = `https://auth.tlauncher.org/skin/fileservice/skins/skin_${player}.png`;
        break;
      case "elyby":
        upstream = `http://skinsystem.ely.by/skin/${player}.png`;
        break;
    }

    const cache = caches.default;

    /**
     * Serve cached response if available.
     */
    const cached = await cache.match(request);
    if (cached) return cached;

    /**
     * Primary upstream fetch.
     */
    let resp = await fetchSkin(upstream);

    /**
     * Fallback 1:
     * For non-Minecraft providers, fallback to Minotar.
     */
    if (!resp.ok && source !== "minecraft") {
      resp = await fetchSkin(`https://minotar.net/skin/${player}`);
    }

    /**
     * Fallback 2:
     * Use default Steve skin if skin not available.
     */
    if (!resp.ok) {
      resp = await fetchSkin("https://minotar.net/skin/MHF_Steve");
    }

    /**
     * Final response.
     */
    const finalResp = new Response(resp.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600"
      }
    });

    /**
     * Cache the final response.
     */
    ctx.waitUntil(cache.put(request, finalResp.clone()));

    return finalResp;
  }
};

/**
 * Fetch wrapper with custom User-Agent.
 */
async function fetchSkin(url) {
  return fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "syanic-mcskins-api" }
  });
}
