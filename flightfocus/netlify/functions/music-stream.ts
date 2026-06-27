import { Handler } from '@netlify/functions';

/**
 * Resolves the Jamendo streaming URL for a track id and proxies the audio
 * stream back to the client. This avoids CORS issues that occur with a 302
 * redirect to Jamendo's CDN.
 */
export const handler: Handler = async (event) => {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return { statusCode: 400, body: 'JAMENDO_CLIENT_ID not configured' };
  }

  const id = event.queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, body: 'Missing track id' };
  }

  try {
    // Resolve the track's audio URL from Jamendo's API.
    const metaParams = new URLSearchParams({
      client_id: clientId,
      format: 'json',
      id,
      audioformat: 'mp32',
    });
    const metaRes = await fetch(`https://api.jamendo.com/v3.0/tracks/?${metaParams.toString()}`);
    if (!metaRes.ok) throw new Error(`Jamendo meta ${metaRes.status}`);
    const meta = await metaRes.json();
    const audioUrl: string | undefined = meta?.results?.[0]?.audio;
    if (!audioUrl) {
      return { statusCode: 404, body: 'Track not found' };
    }

    // Fetch the audio and stream it back.
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Audio fetch ${audioRes.status}`);

    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    const contentLength = audioRes.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    // Support range requests for seeking.
    const range = event.headers['range'];
    if (range && audioRes.status === 206) {
      headers['Accept-Ranges'] = 'bytes';
      headers['Content-Range'] = audioRes.headers.get('content-range') || '';
    }

    const arrayBuffer = await audioRes.arrayBuffer();

    return {
      statusCode: audioRes.status,
      headers,
      body: Buffer.from(arrayBuffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: error instanceof Error ? error.message : 'Stream failed',
    };
  }
};
