import Link from "next/link";

import type { TutorialDocument } from "../lib/tutorials";
import type { Locale } from "../lib/site";

const accentStyles = {
  apple: {
    mark: "bg-[#202124] text-white",
    border: "border-[#202124]/18",
    wash: "bg-[#202124]/[0.045]",
  },
  google: {
    mark: "bg-[#1a73e8] text-white",
    border: "border-[#1a73e8]/20",
    wash: "bg-[#1a73e8]/[0.055]",
  },
  outlook: {
    mark: "bg-[#0f6cbd] text-white",
    border: "border-[#0f6cbd]/20",
    wash: "bg-[#0f6cbd]/[0.055]",
  },
} as const;

export function TutorialMark({ tutorial }: { tutorial: TutorialDocument }) {
  const letter = tutorial.accent === "apple" ? "A" : tutorial.accent === "google" ? "G" : "O";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-semibold shadow-sm ${accentStyles[tutorial.accent].mark}`}
    >
      {letter}
    </span>
  );
}

export function TutorialCard({
  availabilityLabel,
  durationLabel,
  href,
  linkTypeLabel,
  locale,
  openGuideLabel,
  tutorial,
}: {
  availabilityLabel: string;
  durationLabel: string;
  href: string;
  linkTypeLabel: string;
  locale: Locale;
  openGuideLabel: string;
  tutorial: TutorialDocument;
}) {
  const styles = accentStyles[tutorial.accent];

  return (
    <article className={`group flex h-full flex-col rounded-3xl border bg-white/88 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles.border}`}>
      <div className="flex items-start gap-4">
        <TutorialMark tutorial={tutorial} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink/58">{tutorial.service}</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">{tutorial.device}</h3>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-ink/72">{tutorial.description}</p>

      <dl className={`mt-6 grid gap-3 rounded-2xl p-4 text-sm ${styles.wash}`}>
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <dt className="text-ink/55">{durationLabel}</dt>
          <dd className="font-medium text-ink/82">{tutorial.duration}</dd>
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <dt className="text-ink/55">{linkTypeLabel}</dt>
          <dd className="font-medium text-ink/82">{tutorial.linkType}</dd>
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <dt className="text-ink/55">{availabilityLabel}</dt>
          <dd className="font-medium text-ink/82">{tutorial.availability}</dd>
        </div>
      </dl>

      <Link
        className="mt-6 inline-flex min-h-11 items-center justify-between rounded-2xl bg-header px-4 py-3 text-sm font-semibold text-white transition hover:bg-header/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header"
        href={href}
        hrefLang={locale}
      >
        <span>{openGuideLabel}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export function TutorialPath({ label, path }: { label: string; path: string[] }) {
  return (
    <div aria-label={label} className="flex flex-wrap items-center gap-2">
      {path.map((segment, index) => (
        <span className="contents" key={`${index}-${segment}`}>
          <span className="inline-flex min-h-9 items-center rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm font-medium leading-5 text-ink shadow-sm">
            {segment}
          </span>
          {index < path.length - 1 ? (
            <span aria-hidden="true" className="text-sm text-ink/38">
              →
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
