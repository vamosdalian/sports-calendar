import type { Metadata } from "next";

import { siteUrl, type Locale } from "./site";

const SOCIAL_IMAGE_WIDTH = 1200;
const SOCIAL_IMAGE_HEIGHT = 630;
type SocialMetadataOptions = {
  canonicalPath: string;
  description: string;
  imageAlt: string;
  imagePath?: string;
  locale: Locale;
  title: string;
};

/**
 * The metadata read by link-preview crawlers such as Facebook, LinkedIn,
 * Discord, Slack and X. Keeping it in one helper prevents a team page from
 * quietly drifting away from the season and home page card conventions.
 */
export function buildSocialMetadata({
  canonicalPath,
  description,
  imageAlt,
  imagePath,
  locale,
  title,
}: SocialMetadataOptions): Pick<Metadata, "openGraph" | "twitter"> {
  const canonicalUrl = toAbsoluteUrl(canonicalPath);
  const imageUrl = toAbsoluteUrl(imagePath ?? `/social/home-${locale}.png`);
  const image = {
    url: imageUrl,
    width: SOCIAL_IMAGE_WIDTH,
    height: SOCIAL_IMAGE_HEIGHT,
    alt: imageAlt,
    type: "image/png",
  };

  return {
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalUrl,
      siteName: "sports-calendar.com",
      locale: locale === "zh" ? "zh_CN" : "en_GB",
      alternateLocale: locale === "zh" ? ["en_GB"] : ["zh_CN"],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: imageUrl, alt: imageAlt }],
    },
  };
}

export function toLeagueSocialImagePath(leagueSlug: string, seasonSlug: string, locale: Locale) {
  return `/social/league-${encodeURIComponent(leagueSlug)}-${encodeURIComponent(seasonSlug)}-${locale}.png`;
}

function toAbsoluteUrl(path: string) {
  return new URL(path, `${siteUrl}/`).toString();
}
