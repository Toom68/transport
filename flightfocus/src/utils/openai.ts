import type { Airport } from '@/types/airport';
import type { Place } from '@/types/place';

export interface JournalGenerationResult {
  text: string;
  isFallback: boolean;
}

function durationFlavour(ambientMinutes: number): string {
  if (ambientMinutes < 45) return 'They were only there briefly, barely time to settle in.';
  if (ambientMinutes < 240) return 'They spent a few unhurried hours there.';
  if (ambientMinutes < 600) return 'They spent the better part of a day there.';
  return 'They lingered there for a long, slow stretch of time.';
}

function timeOfDayHint(): string {
  const h = new Date().getHours();
  if (h < 6) return 'the small hours before dawn';
  if (h < 12) return 'the morning';
  if (h < 17) return 'the afternoon';
  if (h < 21) return 'the evening';
  return 'late at night';
}

/**
 * Local, deterministic-ish fallback used when the API key is missing or a
 * request fails. Produces a short, evocative paragraph from fragments.
 */
export function fallbackJournalEntry(from: Place, to: Place, ambientMinutes: number): string {
  const sensory = [
    `the smell of coffee and rain drifting through ${from.city}`,
    `the particular grey light over ${from.city} that afternoon`,
    `a street musician somewhere below the window in ${from.city}`,
    `the hum of ${from.city} settling into evening`,
    `the taste of something I couldn't name from a stall in ${from.city}`,
    `cold air and old stone in the older quarters of ${from.city}`,
    `the way the trams in ${from.city} cut the quiet`,
  ];
  const closers = [
    `Now ${to.city} is waiting, and I'm not quite ready to leave.`,
    `I packed slowly. ${to.city} can wait a few more minutes.`,
    `Onward to ${to.city}, headphones on, the world narrowing to a window seat.`,
    `${to.city} next. I always travel best with a little hum in my ears.`,
    `The gate to ${to.city} is calling. I leave a piece of ${from.city} behind.`,
  ];
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const dur = durationFlavour(ambientMinutes).toLowerCase();
  return `${capitalize(timeOfDayHint())} in ${from.city}, ${from.country}. ${capitalize(dur)} What stays with me is ${pick(sensory)}. ${pick(closers)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generates a short fictional travel-journal entry about the user's time in
 * `from`, as they set off for `to`. Falls back to a local template on any
 * failure so the UI never blocks.
 */
export async function generateJournalEntry(
  from: Place,
  to: Place,
  ambientMinutes: number
): Promise<JournalGenerationResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch('/.netlify/functions/generate-journal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, ambientMinutes }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Netlify function ${res.status}`);
    }

    const data = await res.json();
    const text: string | undefined = data?.text;
    if (!text) throw new Error('empty response');

    return { text, isFallback: data?.isFallback ?? false };
  } catch {
    return { text: fallbackJournalEntry(from, to, ambientMinutes), isFallback: true };
  }
}
