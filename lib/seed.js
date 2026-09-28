const HANDLES = [
  "mochi_mae",
  "tradie_tom",
  "sleepyk0ala",
  "pixelpav",
  "bao_bandit",
  "nightowl_nic",
  "crumpet_kid",
  "saltyseagull",
  "gumtree_gus",
  "lamington_lee",
  "wattle_wren",
  "vegemite_vic",
];
const voters = (n, from) => Array.from({ length: n }, (_, i) => HANDLES[(from + i) % HANDLES.length]);

export function seed() {
  let n = 0;
  let a = 0;
  const app = (login, vod, note, status, reason = "") => {
    a += 1;
    return {
      id: `seed-app-${a}`,
      login,
      vod,
      note,
      status,
      reason,
      createdAt: new Date(Date.UTC(2026, 9, 6 + a)).toISOString(),
      decidedAt: status === "pending" ? "" : new Date(Date.UTC(2026, 9, 7 + a)).toISOString(),
      decidedBy: status === "pending" ? "" : "jelapiii",
    };
  };
  const idea = (title, description, votes, extra = {}) => {
    n += 1;
    return {
      id: `seed-${n}`,
      title,
      description,
      author: HANDLES[n % HANDLES.length],
      anonymous: false,
      status: "approved",
      votes: voters(votes, n),
      reason: "",
      createdAt: new Date(Date.UTC(2026, 8, 20 - n)).toISOString(),
      ...extra,
    };
  };

  return {
    seen: ["mochi_mae", "pixelpav", "bao_bandit", "tradie_tom", "wattle_wren", "crumpet_kid", "sleepyk0ala"],
    settings: {
      twitch: "jelapiii",
      spinDate: "2026-11-02",
      spinTime: "19:00",
      siteUrl: "",
      webhook: "",
      logoUrl: "",
      discordUrl: "https://discord.gg/example",
      viewersBefore: "18",
      viewersNow: "",
    },
    current: {
      month: "2026-10",
      title: "Barista",
      description: "From instant coffee to running a pop-up café for chat.",
      week: 2,
      outcome: "active",
      passCondition:
        "Serve 10 drinks off a chat-picked menu in one stream, 3 of them with latte art, and score 7/10 or better from a tasting panel.",
      goals: [
        { text: "Pull a shot in 25 to 30 seconds", done: true },
        { text: "Steam milk to microfoam", done: false },
        { text: "Pour a latte art heart", done: false },
      ],
      updates: {
        1: "The wheel landed on Barista with 4 tickets. Goals and the pass condition got set live with chat.",
        2: "40 shots pulled. Chat redeemed Try Again twice on my first flat white.",
        3: "",
        4: "",
      },
      tryAgain: { 1: 0, 2: 2, 3: 0, 4: 0 },
      along: ["mochi_mae", "pixelpav", "bao_bandit", "wattle_wren", "crumpet_kid"],
      links: "Week 1 VOD: the spin | https://www.youtube.com/\nWatch live | https://www.twitch.tv/",
    },
    ideas: [
      idea("Skateboard ollie", "Land a clean ollie by the end of the month.", 5),
      idea("Juggle three balls", "", 4),
      idea("Solve a Rubik's cube", "Under 2 minutes, no notes.", 3, { anonymous: true }),
      idea("Nail a TikTok dance", "Chat picks the dance.", 2),
      idea("Auslan basics", "Hold a 2 minute conversation in sign language.", 1),
      idea("Make sushi", "", 0),
      idea("Beatboxing", "", 0),
      idea("Stand-up comedy set", "5 minutes, live, to chat.", 0, { status: "pending", anonymous: true }),
      idea("Pottery", "Throw a bowl on a wheel.", 0, { status: "pending" }),
      idea("Barista", "From instant coffee to running a pop-up café for chat.", 3, { status: "selected" }),
    ],
    draw: null,
    drawLog: [],
    modLog: [],
    mods: [],
    partners: ["mochi_mae", "tradie_tom", "sleepyk0ala"],
    applications: [
      app("pixelpav", "https://www.twitch.tv/videos/2410098311", "Pulled my first shots on stream last Tuesday.", "pending"),
      app("mochi_mae", "https://www.twitch.tv/videos/2409551204", "Doing the barista month alongside Jelarp.", "approved"),
      app("tradie_tom", "https://clips.twitch.tv/SparklyCrunchyOtterKappa", "", "approved"),
      app("sleepyk0ala", "https://www.twitch.tv/videos/2408877190", "Latte art attempt one, it went badly.", "approved"),
      app("saltyseagull", "https://www.twitch.tv/videos/2407412006", "", "rejected", "The VOD is a different challenge, not this month's LARP."),
    ],
    checklists: {
      mochi_mae: { month: "2026-10", weeks: [1], goals: [0] },
      tradie_tom: { month: "2026-10", weeks: [1, 2], goals: [0, 1] },
    },
    archive: [
      {
        month: "2026-09",
        title: "Crochet a beanie",
        outcome: "passed",
        summary: "Finished the beanie and wore it for the whole Week 4 stream.",
        links: "Full journey | https://www.youtube.com/",
        tryAgains: 3,
        along: 4,
      },
      {
        month: "2026-08",
        title: "Cook a 3-course dinner",
        outcome: "not-passed",
        summary: "Dessert collapsed. Chat voted it a fail.",
        links: "",
        tryAgains: 5,
        along: 2,
      },
    ],
  };
}
