import { setRequestLocale } from "next-intl/server";

import { RememberedLocaleRedirect } from "../../components/remembered-locale-redirect";
import { generateHomeMetadata, renderHomePage } from "../home-page";

export async function generateMetadata() {
  return generateHomeMetadata("en", "/");
}

export default async function RootHomePage() {
  setRequestLocale("en");

  return (
    <>
      <RememberedLocaleRedirect />
      {await renderHomePage("en", "/")}
    </>
  );
}
