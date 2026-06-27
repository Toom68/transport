import { Handler } from '@netlify/functions';

type Genre = 'classical' | 'jazz' | 'lofi' | 'ambient' | 'electronic' | 'cinematic';

// Handpicked, focus-friendly query profiles per genre: instrumental, low-energy.
const GENRE_QUERY: Record<Genre, { tags: string; fuzzytags: string }> = {
  classical: { tags: 'classical', fuzzytags: 'piano+ambient+instrumental' },
  jazz: { tags: 'jazz', fuzzytags: 'lounge+smooth+instrumental' },
  lofi: { tags: 'lofi', fuzzytags: 'chillout+downtempo+instrumental' },
  ambient: { tags: 'ambient', fuzzytags: 'drone+atmospheric+instrumental' },
  electronic: { tags: 'electronic', fuzzytags: 'downtempo+synthwave+instrumental' },
  cinematic: { tags: 'soundtrack', fuzzytags: 'cinematic+orchestral+instrumental' },
};

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  duration: number;
  license_ccurl: string;
}

export const handler: Handler = async (event) => {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'JAMENDO_CLIENT_ID not configured' }),
    };
  }

  const genreParam = (event.queryStringParameters?.genre || 'lofi').toLowerCase();
  const genre: Genre = (['classical', 'jazz', 'lofi', 'ambient', 'electronic', 'cinematic'].includes(genreParam) ? genreParam : 'lofi') as Genre;
  const q = GENRE_QUERY[genre];

  const params = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '30',
    order: 'popularity_month',
    vocalinstrumental: 'instrumental',
    tags: q.tags,
    fuzzytags: q.fuzzytags,
    speed: 'low',
    audioformat: 'mp32',
    include: 'musicinfo',
    groupby: 'artist_id',
  });

  try {
    const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`);
    if (!res.ok) throw new Error(`Jamendo ${res.status}`);
    const data = await res.json();
    const results: JamendoTrack[] = data?.results ?? [];

    const tracks = results.map((t) => ({
      id: t.id,
      title: t.name,
      artist: t.artist_name,
      duration: t.duration,
      license: t.license_ccurl,
      // Stream through our own proxy so the browser never touches Jamendo's CDN.
      streamUrl: `/.netlify/functions/music-stream?id=${encodeURIComponent(t.id)}`,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
      body: JSON.stringify({ genre, tracks }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Jamendo request failed' }),
    };
  }
};
