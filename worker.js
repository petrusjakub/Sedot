/**
 * Cloudflare Worker - Video Proxy API
 * Proxies requests to Cobalt API for social media content downloading.
 * Handles CORS and forwards download parameters.
 *
 * Deploy with: wrangler deploy worker.js
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ status: 'error', error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
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
            'Access-Control-Allow-Origin': '*'
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

      // Forward to Cobalt API
      const cobaltResponse = await fetch('https://api.cobalt.tools/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(cobaltBody)
      });

      const cobaltData = await cobaltResponse.json();

      // Return Cobalt response to frontend
      return new Response(JSON.stringify(cobaltData), {
        status: cobaltResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
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
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
