export default function sitemap() {
  return ["", "/board", "/archive"].map((p) => ({ url: `https://www.jelarp.com${p}`, changeFrequency: "weekly" }));
}
