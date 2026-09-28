import { Suspense } from "react";
import { Bricolage_Grotesque, Bungee } from "next/font/google";
import Nav, { Footer, Toast } from "@/components/Nav";
import { AskDialog } from "@/components/Ask";
import Theme from "@/components/Theme";
import "./globals.css";

const sans = Bricolage_Grotesque({ subsets: ["latin"], variable: "--nf-bricolage" });
const bungee = Bungee({ subsets: ["latin"], weight: "400", variable: "--nf-bungee" });

const description = "Orchi learns one chat-picked skill a month on Twitch. Suggest a skill, vote on it, and watch the wheel pick on the first stream of the month.";

export const metadata = {
  metadataBase: new URL("https://www.jelarp.com"),
  title: { default: "Jelarp of All Trades · one chat-picked skill a month", template: "%s · Jelarp of All Trades" },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Jelarp of All Trades", title: "Jelarp of All Trades", description, url: "/", images: [{ url: "/logo.png", width: 256, height: 256, alt: "Jelarp of All Trades" }] },
  twitter: { card: "summary" },
};

export const viewport = { themeColor: "#0f0b17" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${bungee.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Theme />
        {/* Both read the query string, for ?obs=1, and a component that reads it
            cannot be prerendered without a boundary. Without these the build
            fails on the 404 page, which is the one route Next insists on
            rendering statically. The fallback is nothing on purpose: the bar
            appearing a frame late is better than a placeholder bar. */}
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        {children}
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
        <Toast />
        <AskDialog />
      </body>
    </html>
  );
}
