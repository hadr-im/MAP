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
 *  - "intro" hides hero elements so their entrance can play on every visit without a flash;
 *  - "lights" shows the start-lights loader, once per session.
 * Both are removed after 4s as a safety net if scripts fail (the loader itself never exceeds 2.2s).
 */
const introScript = `try{if(location.pathname==='/'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){var d=document.documentElement;d.classList.add('intro');if(!sessionStorage.getItem('map-lights'))d.classList.add('lights');setTimeout(function(){d.classList.remove('intro','lights')},4000)}}catch(e){}`;

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
