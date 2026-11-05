// Pure helpers for the "How to do it" view. No React, no network: easy to test.

/** Turns stored instructions ("1. Do this.\r\n2. Then that.") into clean steps. */
export function parseSteps(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map(s => s.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(s => s.length > 0);
}

/** A YouTube search for the exercise. We don't host videos, so this is the fallback for every exercise. */
export function videoSearchUrl(name: string): string {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${name.trim()} proper form`);
}
