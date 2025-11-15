export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/" || path === "/index") {
      return Response.redirect("https://github.com/xsyanic/mcskins-api", 302);
    }

    const match = path.match(
      /^\/skin(?:\/(minecraft|tlauncher|elyby|sklauncher))?\/([^\/]+?)(?:\.png)?$/
    );

    if (!match) return new Response("Not Found", { status: 404 });

    const source = match[1] || "minecraft";
    const player = match[2];

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(player))
      return new Response("Invalid IGN", { status: 400 });

    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    let resp = null;

    if (source === "sklauncher") {
      const skinUrl = await getSklauncherSkinUrl(player);
      if (skinUrl) {
        resp = await fetchSkin(skinUrl, { "User-Agent": "sklauncher/3.2" });
      }
    }

    if (!resp || !resp.ok) {
      switch (source) {
        case "minecraft":
          resp = await fetchSkin(`https://minotar.net/skin/${player}`);
          break;
        case "tlauncher":
          resp = await fetchSkin(`https://auth.tlauncher.org/skin/fileservice/skins/skin_${player}.png`);
          break;
        case "elyby":
          resp = await fetchSkin(`http://skinsystem.ely.by/skin/${player}.png`);
          break;
      }
    }

    if (!resp || !resp.ok)
      resp = await fetchSkin(`https://minotar.net/skin/${player}`);

    if (!resp.ok)
      resp = await fetchSkin("https://minotar.net/skin/MHF_Steve");

    const finalResp = new Response(resp.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60"
      }
    });

    ctx.waitUntil(cache.put(request, finalResp.clone()));
    return finalResp;
  }
};

async function fetchSkin(url, extraHeaders = {}) {
  try {
    return await fetch(url, {
      redirect: "follow",
      headers: Object.assign({ "User-Agent": "syanic-mcskins-api" }, extraHeaders)
    });
  } catch (e) {
    return new Response(null, { status: 502 });
  }
}

async function getSklauncherSkinUrl(username) {
  try {
    const uuidHex = await sklUUID(username);

    const profileReq = await fetch(
      `https://sessionserver.skmedix.pl/profile/${uuidHex}.json`,
      { headers: { "User-Agent": "sklauncher/3.2" }, redirect: "follow" }
    );

    if (!profileReq.ok) return null;

    const profile = await profileReq.json();
    if (!profile.properties?.length) return null;

    const raw = profile.properties[0].value;
    const decoded = JSON.parse(atob(raw));

    return decoded?.textures?.SKIN?.url || null;
  } catch {
    return null;
  }
}

async function sklUUID(username) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode("OfflinePlayer:" + username);
  const buf = await crypto.subtle.digest("MD5", bytes);
  const hash = new Uint8Array(buf);

  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
