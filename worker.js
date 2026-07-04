/**
 * Cloudflare Worker - Video Proxy API
 * Proxies requests to Cobalt API for social media content downloading.
 * Handles CORS and forwards download parameters.
 * Also serves the index.html frontend on GET requests.
 *
 * Environment variables:
 *   - COBALT_API_KEY (optional): API key for Cobalt API authentication
 *
 * Deploy with: wrangler deploy worker.js
 */

import HTML_CONTENT from './index.html';

// Cobalt API endpoints - primary and fallbacks
const COBALT_API_ENDPOINTS = [
  'https://api.cobalt.tools/',
  'https://cobalt-api.kwiatekmiki.com/'
];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // Serve index.html on GET requests
    if (request.method === 'GET') {
      return new Response(HTML_CONTENT, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...corsHeaders()
        }
      });
    }

    // Only allow POST for API calls
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ status: 'error', error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
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
            ...corsHeaders()
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

      // Try each Cobalt API endpoint until one succeeds
      let cobaltResponse = null;
      let lastError = null;

      for (const endpoint of COBALT_API_ENDPOINTS) {
        try {
          cobaltResponse = await fetch(endpoint, {
            method: 'POST',
            headers: cobaltHeaders,
            body: JSON.stringify(cobaltBody)
          });

          // If we got a response (even an error response), use it
          if (cobaltResponse.ok || cobaltResponse.status < 500) {
            break;
          }

          // Server error - try next endpoint
          lastError = new Error('API returned status ' + cobaltResponse.status);
          cobaltResponse = null;
        } catch (err) {
          lastError = err;
          cobaltResponse = null;
        }
      }

      // If all endpoints failed
      if (!cobaltResponse) {
        return new Response(JSON.stringify({
          status: 'error',
          error: 'All API endpoints failed: ' + (lastError ? lastError.message : 'unknown error')
        }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders()
          }
        });
      }

      const cobaltData = await cobaltResponse.json();

      // Return Cobalt response to frontend
      return new Response(JSON.stringify(cobaltData), {
        status: cobaltResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
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
          ...corsHeaders()
        }
      });
    }
  }
};
