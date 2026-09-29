import type { Metadata } from "next";
import "./globals.css";
import { TwinProvider } from "@/lib/useTwin";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "GridGuard Twin — Predict early. Act fairly. Waste less solar.",
  description:
    "A digital twin for solar-heavy power lines. It spots voltage and overload problems 15–60 minutes early, tests every fix, and picks the safest one that wastes the least solar — with the reasons in plain words.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>"
        />
      </head>
      <body className="min-h-screen">
        <TwinProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
        </TwinProvider>
      </body>
    </html>
  );
}
