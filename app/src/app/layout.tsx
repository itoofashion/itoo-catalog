import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";

/** The typeface itoo's own storefront is set in, so the two read as one brand. */
const sans = Raleway({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "itoo · Wholesale Catalog",
  description: "Current styles, prices and photos from itoo.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-icon.png",
  },
  // Belt and braces with robots.ts: a shared link is for the client it was sent
  // to, not for a search result. Chat previews are unaffected: they fetch the
  // page themselves rather than consulting robots rules.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
