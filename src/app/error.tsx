"use client";

import { Brand } from "@/components/race/brand";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-4 sm:px-6">
      <Brand />
      <h1 className="condensed mt-8 text-6xl font-bold uppercase sm:text-8xl">Red flag</h1>
      <p className="mt-5 max-w-[48ch] text-chalk-dim">
        The standings couldn&apos;t load because the timing data is unreachable right now. Try again in a moment. If it keeps happening, an admin should check the Google Sheets connection.
      </p>
      <button type="button" onClick={reset} className="mt-8 h-11 w-fit rounded-[2px] bg-chalk px-6 font-semibold text-ink transition-colors duration-150 hover:bg-white">
        Try again
      </button>
    </main>
  );
}
