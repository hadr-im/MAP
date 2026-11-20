import type { Metadata, Viewport } from "next";
import {
  Archivo,
  Big_Shoulders,
  Instrument_Serif,
  Michroma,
} from "next/font/google";
import "./globals.css";

/** Display: tall, heavy, industrial. Headlines and big numerals. */
const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display-face",
  display: "swap",
});

/** Accent: italic serif, used stretched for the secondary line. */
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["italic"],
  variable: "--font-serif-face",
  display: "swap",
});

/** Wide racing face (Microgramma lineage) for the hero's second line. */
const wide = Michroma({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wide-face",
  display: "swap",
});

/** Interface text and tabular numbers. */
const sans = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "MAP S2 ", template: "%s | MAP S2" },
  description:
    "Welcome to the MAP Race. Live standings for MAP 26.27 S2, and the trophies waiting at the top.",
};

export const viewport: Viewport = {
  themeColor: "#111111",
  colorScheme: "dark",
};

/**
 * Before first paint on the home page (never for reduced motion):
 *  - "intro" hides hero elements so their entrance can play without a flash;
 *  - "lights" shows the start-lights loader. Both run on every load, including a refresh.
 * They are removed after 6s as a safety net if scripts fail (the sequence itself takes about 2.7s).
 */
const introScript = `try{if(location.pathname==='/'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){var d=document.documentElement;d.classList.add('intro','lights');setTimeout(function(){d.classList.remove('intro','lights')},6000)}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${serif.variable} ${wide.variable} ${sans.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
