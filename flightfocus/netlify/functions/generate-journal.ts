import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { from, to, ambientMinutes } = JSON.parse(event.body || '{}');
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'OpenAI API key not configured' }),
      };
    }

    const durationFlavour = (ambientMinutes: number): string => {
      if (ambientMinutes < 45) return 'They were only there briefly, barely time to settle in.';
      if (ambientMinutes < 240) return 'They spent a few unhurried hours there.';
      if (ambientMinutes < 600) return 'They spent the better part of a day there.';
      return 'They lingered there for a long, slow stretch of time.';
    };

    const timeOfDayHint = (): string => {
      const h = new Date().getHours();
      if (h < 6) return 'the small hours before dawn';
      if (h < 12) return 'the morning';
      if (h < 17) return 'the afternoon';
      if (h < 21) return 'the evening';
      return 'late at night';
    };

    const prompt = [
      `Write a single travel journal entry — at most 2 sentences, first person, past tense.`,
      `The narrator is leaving ${from.city}, ${from.country} after ${durationFlavour(ambientMinutes).toLowerCase().replace('they ', 'i ')} Now flying onward to ${to.city}, ${to.country}.`,
      `Include one specific sensory detail about ${from.city} — a sound, a smell, or something seen from a window.`,
      `No cliches, no tourist language, no mention of work or laptops. Under 40 words. Return only the entry text.`,
    ].join(' ');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a spare, literary travel diarist. You write brief, sensory, understated journal entries. No cliches, no exclamation marks, no lists.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 160,
        temperature: 0.9,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}`);
    }

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('empty completion');

    const stripWrappingQuotes = (s: string): string => {
      return s.replace(/^["'\u201c\u2018]+/, '').replace(/["'\u201d\u2019]+$/, '').trim();
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ text: stripWrappingQuotes(text), isFallback: false }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
    };
  }
};
