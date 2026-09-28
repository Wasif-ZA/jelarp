export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/studio", "/draw", "/overlay", "/partner", "/api/"] },
    sitemap: "https://www.jelarp.com/sitemap.xml",
  };
}
