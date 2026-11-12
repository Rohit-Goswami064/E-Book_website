import type { Metadata, Viewport } from "next";
import { Outfit, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#F6F5F2",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://hiddenbooks.com"),
  title: {
    default: "HiddenBooks — Premium Digital eBook & Audiobook Destination",
    template: "%s | HiddenBooks",
  },
  description:
    "Discover, purchase, and read valuable eBooks and audiobooks. A calm, intellectual, and curated reading experience with instant access across all your devices.",
  keywords: [
    "ebooks",
    "audiobooks",
    "books online",
    "hindi books",
    "reading app",
    "digital library",
    "hiddenbooks",
  ],
  authors: [{ name: "HiddenBooks Editorial" }],
  creator: "HiddenBooks",
  publisher: "HiddenBooks Publishing",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/hiddenbook_logo.png",
    shortcut: "/hiddenbook_logo.png",
    apple: "/hiddenbook_logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "HiddenBooks",
    title: "HiddenBooks — Premium Digital eBook Destination",
    description: "Curated books, seamless reader, and timeless knowledge.",
    images: [
      {
        url: "/hiddenbook_logo.png",
        width: 1254,
        height: 1254,
        alt: "HiddenBooks Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HiddenBooks",
    description: "Curated books, seamless reader, and timeless knowledge.",
    images: ["/hiddenbook_logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${outfit.variable} ${newsreader.variable} scroll-smooth`}
    >
      <body className="min-h-screen flex flex-col bg-[#F6F5F2] text-[#111111] font-sans antialiased selection:bg-[#111111] selection:text-white">
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
