/**
 * Cloudflare Worker - Video Proxy API
 * Proxies requests to Cobalt API for social media content downloading.
 * Handles CORS and forwards download parameters.
 *
 * Environment variables:
 *   - COBALT_API_KEY (optional): API key for Cobalt API authentication
 *   - ALLOWED_ORIGINS (optional): Comma-separated list of allowed origins.
 *     Defaults to allowing the worker's own domain pattern.
 *
 * Deploy with: wrangler deploy worker.js
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://petrusjakub.github.io',
  'http://localhost',
  'http://127.0.0.1'
];

function getAllowedOrigins(env) {
  if (env && env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(function(o) { return o.trim(); });
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(request, env) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const allowedOrigins = getAllowedOrigins(env);

  // Check Origin header
  if (origin) {
    for (const allowed of allowedOrigins) {
      if (origin === allowed || origin.startsWith(allowed)) {
        return origin;
      }
    }
    return null;
  }

  // Fallback to Referer header
  if (referer) {
    for (const allowed of allowedOrigins) {
      if (referer.startsWith(allowed)) {
        return allowed;
      }
    }
    return null;
  }

  // No Origin or Referer - reject
  return null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || DEFAULT_ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const allowedOrigin = isOriginAllowed(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!allowedOrigin) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(allowedOrigin)
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ status: 'error', error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(allowedOrigin)
        }
      });
    }

    // Reject disallowed origins
    if (!allowedOrigin) {
      return new Response(JSON.stringify({ status: 'error', error: 'Origin not allowed' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    try {
      const body = await request.json();

      // Validate required field
      if (!body.url) {
        return new Response(JSON.stringify({ status: 'error', error: 'URL is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(allowedOrigin)
          }
        });
      }

      // Build Cobalt API request body
      const cobaltBody = {
        url: body.url,
        downloadMode: body.downloadMode || 'auto',
        videoQuality: body.videoQuality || 'max',
        filenameStyle: body.filenameStyle || 'basic',
        tiktokFullAudio: body.tiktokFullAudio !== undefined ? body.tiktokFullAudio : true,
        tiktokH265: body.tiktokH265 !== undefined ? body.tiktokH265 : false,
        disableMetadata: body.disableMetadata !== undefined ? body.disableMetadata : false
      };

      // Build headers for Cobalt API request
      const cobaltHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Add Authorization header if API key is configured
      if (env && env.COBALT_API_KEY) {
        cobaltHeaders['Authorization'] = 'Api-Key ' + env.COBALT_API_KEY;
      }

      // Forward to Cobalt API
      const cobaltResponse = await fetch('https://api.cobalt.tools/', {
        method: 'POST',
        headers: cobaltHeaders,
        body: JSON.stringify(cobaltBody)
      });

      const cobaltData = await cobaltResponse.json();

      // Return Cobalt response to frontend
      return new Response(JSON.stringify(cobaltData), {
        status: cobaltResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(allowedOrigin)
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        status: 'error',
        error: 'Internal server error: ' + error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(allowedOrigin)
        }
      });
    }
  }
};
