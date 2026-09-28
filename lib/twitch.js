import { auth, setNotice } from "@/lib/store";
import { DEMO } from "@/lib/demo";
import { ask } from "@/components/Ask";

const CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;

export async function signIn() {
  if (DEMO) {
    const values = await ask({
      title: "Try the demo",
      body: "Pick any name and a role. Everything you do saves in this browser only, so none of it is real.",
      fields: [
        { name: "login", label: "Name", placeholder: "orchi", required: true, maxLength: 25, pattern: "[A-Za-z0-9_]+", hint: "Letters, numbers and underscores." },
        {
          name: "role",
          label: "Role",
          type: "select",
          defaultValue: "creator",
          options: [
            ["creator", "Creator: Studio and the wheel"],
            ["mod", "Mod: approve ideas, count Try Agains"],
            ["viewer", "Viewer: suggest and vote"],
          ],
        },
      ],
      confirm: "Start",
    });
    return values ? auth("POST", values) : false;
  }
  if (!CLIENT_ID) {
    const login = await ask({
      title: "Sign in",
      body: "Twitch sign-in is not connected yet, so pick any username to try the site.",
      input: {
        label: "Username",
        placeholder: "your_twitch_name",
        required: true,
        maxLength: 25,
        pattern: "[A-Za-z0-9_]+",
        hint: "Letters, numbers and underscores.",
      },
      confirm: "Sign in",
    });
    return login ? auth("POST", { login }) : false;
  }
  const state = crypto.randomUUID();
  sessionStorage.setItem("twitch-state", state);
  sessionStorage.setItem("twitch-return", location.pathname);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${location.origin}/`,
    response_type: "token",
    scope: "",
    state,
  });
  location.assign(`https://id.twitch.tv/oauth2/authorize?${params}`);
  return false;
}

export async function finishSignIn() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const token = hash.get("access_token");
  if (!token || !CLIENT_ID) return;

  const expected = sessionStorage.getItem("twitch-state");
  sessionStorage.removeItem("twitch-state");
  history.replaceState(null, "", location.pathname + location.search);
  if (!expected || hash.get("state") !== expected) return setNotice("Sign-in expired. Try again.");

  await auth("POST", { token });
  const back = sessionStorage.getItem("twitch-return");
  sessionStorage.removeItem("twitch-return");
  if (back && back !== location.pathname) location.assign(back);
}

export const signOut = () => auth("DELETE");
