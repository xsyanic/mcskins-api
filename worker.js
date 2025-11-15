export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/" || path === "/index") {
      return new Response("Docs: https://github.com/xsyanic/mcskins-api", { status: 200 });
    }

    const match = path.match(
      /^\/skin(?:\/(minecraft|tlauncher|elyby|sklauncher))?\/([^\/]+?)(?:\.png)?$/
    );

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    const source = match[1] || "minecraft";
    const player = match[2];

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(player)) {
      return new Response("Invalid IGN", { status: 400 });
    }

    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return cached;

    let resp;

    // ------------------------
    // SKLAUNCHER skin handling
    // ------------------------
    if (source === "sklauncher") {
      const skinUrl = await getSklauncherSkinUrl(player);
      if (skinUrl) {
        resp = await fetchSkin(skinUrl);
      }
    }

    // --------------------------
    // Normal upstream providers
    // --------------------------
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

    // fallback to minotar (Minecraft Skin)
    if (!resp || !resp.ok) {
      resp = await fetchSkin(`https://minotar.net/skin/${player}`);
    }

    // fallback to Steve Skin
    if (!resp.ok) {
      resp = await fetchSkin("https://minotar.net/skin/MHF_Steve");
    }

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

/**
 * Fetch wrapper with custom User-Agent.
 */
async function fetchSkin(url) {
  return fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "syanic-mcskins-api" }
  });
}

/**
 * SKLauncher Username to UUID generator
 */
function sklUUID(username) {
  const name = new TextEncoder().encode("OfflinePlayer:" + username);

  // MD5 hash
  const hash = md5(name);

  // Java bit patches
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  // Convert to hex string
  return [...hash].map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fetch SKLauncher profile & extract SKIN URL.
 */
async function getSklauncherSkinUrl(username) {
  try {
    const uuidHex = sklUUID(username);

    const profileReq = await fetch(
      `https://sessionserver.skmedix.pl/profile/${uuidHex}.json`,
      { headers: { "User-Agent": "sklauncher/3.2" } }
    );

    if (!profileReq.ok) return null;

    const profile = await profileReq.json();
    const b64 = profile.properties[0].value;

    const decoded = JSON.parse(atob(b64));

    if (!decoded.textures?.SKIN?.url) return null;

    return decoded.textures.SKIN.url;
  } catch (e) {
    return null;
  }
}

/**
 * Minimal MD5 implementation for Worker.
 */
function md5(input) {
  return crypto.subtle.digest("MD5", input).then(buf => new Uint8Array(buf));
}
