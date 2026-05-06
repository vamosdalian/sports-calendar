import { setRequestLocale } from "next-intl/server";

import { generateHomeMetadata, renderHomePage } from "./home-page";

export const revalidate = 3600;

export async function generateMetadata() {
  return generateHomeMetadata("en", "/");
}

export default async function RootHomePage() {
  setRequestLocale("en");
  return renderHomePage("en", "/");
}
