import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-6 py-20">
      <div className="rounded-panel bg-white px-8 py-10 text-center shadow-panel">
        <p className="text-xs uppercase tracking-[0.3em] text-header/60">sports-calendar.com</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Page not found</h1>
        <p className="mt-4 max-w-md text-sm leading-7 text-ink/70">
          The requested season route is not available in the current mock catalog.
        </p>
        <Link className="mt-6 inline-flex rounded-full bg-header px-5 py-3 text-sm font-semibold text-white" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}