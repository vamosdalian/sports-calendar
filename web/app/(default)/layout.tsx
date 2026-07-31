import type { ReactNode } from "react";

import type { Metadata } from "next";

import { SiteShell, sharedMetadata } from "../site-shell";
import { defaultLocale } from "../../lib/site";

import "../globals.css";

export const metadata: Metadata = sharedMetadata;

// Root layout for `/`, which is the English home page. Locale-prefixed routes
// have their own root layout under `[lang]`; see app/site-shell.tsx for why
// there are two.
export default function DefaultRootLayout({ children }: { children: ReactNode }) {
  return <SiteShell lang={defaultLocale}>{children}</SiteShell>;
}
