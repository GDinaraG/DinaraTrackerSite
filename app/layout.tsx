import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin", "cyrillic"] });
const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"] });

export const metadata: Metadata = { title: "Blue Nook — трекер, который растёт вместе с вами", description: "Уютный трекер дел, фокус-сессий и виртуального котёнка." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ru"><body className={`${sans.variable} ${display.variable}`}>{children}</body></html> }
