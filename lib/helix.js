const CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Until the Twitch developer app exists, every caller gets an empty list rather than an error.
export const helixReady = () => Boolean(CLIENT_ID && CLIENT_SECRET);

// ponytail: token and cache live on this server instance; a shared store only matters past a few instances.
const store = (globalThis.__helix ??= { token: "", expires: 0, hits: new Map() });

const TTL_MS = 60000;

async function appToken() {
  if (store.token && store.expires > Date.now() + 60000) return store.token;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Twitch token failed: ${res.status}`);
  const data = await res.json();
  store.token = data.access_token;
  store.expires = Date.now() + data.expires_in * 1000;
  return store.token;
}

// R-10: 60 second cache, so a busy stream does not spend the Helix rate limit.
export async function helix(path, pairs) {
  if (!helixReady()) return [];
  const url = `https://api.twitch.tv/helix/${path}?${new URLSearchParams(pairs)}`;
  const hit = store.hits.get(url);
  if (hit && hit.at > Date.now() - TTL_MS) return hit.data;

  let res = await fetch(url, { headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${await appToken()}` }, cache: "no-store" });
  if (res.status === 401) {
    store.token = "";
    res = await fetch(url, { headers: { "Client-Id": CLIENT_ID, Authorization: `Bearer ${await appToken()}` }, cache: "no-store" });
  }
  if (!res.ok) throw new Error(`Twitch ${path} failed: ${res.status}`);
  const { data } = await res.json();
  store.hits.set(url, { at: Date.now(), data: data || [] });
  return data || [];
}

export const usersByLogin = (logins) => helix("users", logins.map((l) => ["login", l]));
export const streamsByLogin = (logins) => helix("streams", logins.map((l) => ["user_login", l]));
