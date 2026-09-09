/**
 * ============================================
 * Universal OpenAI Compatible Proxy Worker
 * Version: v1.4.2 frozen
 * API path allowlist + upstream base path
 *
 * Stateless reverse proxy for OpenAI-compatible APIs
 *
 * Change only:
 * DEFAULT_TARGET_HOST
 * DEFAULT_BASE_PATH
 *
 * ============================================
 */


// ===============================
// Configuration
// ===============================

// Upstream API host
const DEFAULT_TARGET_HOST =
  'developer.amd.com.cn';


// Upstream protocol
const DEFAULT_PROTOCOL =
  'https';


// Upstream optional base path
const DEFAULT_BASE_PATH =
  '/radeon/api';


// API path allowlist
const ALLOWED_PREFIXES = [
  '/v1/',
];


// ===============================
// Helpers
// ===============================


function isJsonRequest(request) {
  return (
    request.headers
      .get('content-type')
      ?.toLowerCase()
      .includes('application/json')
  );
}


// ===============================
// Worker
// ===============================


export default {

  async fetch(request, env, ctx) {

    const url =
      new URL(request.url);

    const pathname =
      url.pathname;

    const isAllowedPath =
      ALLOWED_PREFIXES.some(
        (prefix) => pathname.startsWith(prefix)
      );

    if (!isAllowedPath) {
      return new Response('Not Found', {
        status: 404,
      });
    }

    /*
     * 1. CORS preflight
     */

    if (request.method === 'OPTIONS') {

      return new Response(null, {

        status: 204,

        headers: {

          'Access-Control-Allow-Origin': '*',

          'Access-Control-Allow-Methods':
            'GET, POST, PUT, PATCH, DELETE, OPTIONS',

          'Access-Control-Allow-Headers':
            [
              'Authorization',
              'Content-Type',
              'Accept',
              'OpenAI-Organization',
              'X-API-Key',
            ].join(', '),

          'Access-Control-Max-Age':
            '86400',
        },
      });
    }



    /*
     * 2. Build upstream URL
     */

    const TARGET_HOST =
      env.TARGET_HOST ||
      DEFAULT_TARGET_HOST;

    url.hostname =
      TARGET_HOST;

    url.protocol =
      DEFAULT_PROTOCOL;

    // Inject upstream base path
    const basePath =
      DEFAULT_BASE_PATH === '/'
        ? ''
        : DEFAULT_BASE_PATH.replace(/\/+$/, '');

    url.pathname =
      `${basePath}${url.pathname}`;



    /*
     * 3. Request headers
     */

    const headers =
      new Headers(request.headers);



    // Let Worker generate Host
    headers.delete('host');


    // Body may change
    headers.delete('content-length');


    // Avoid compression issues
    headers.delete('accept-encoding');


    // Remove Cloudflare internal headers
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ray');




    /*
     * 4. Request body passthrough
     */

    let body =
      request.method === 'GET' ||
      request.method === 'HEAD'

        ? null

        : request.body;



    let isStream =
      false;



    /*
     * Detect JSON stream request
     */

    if (

      [
        'POST',
        'PUT',
        'PATCH'
      ].includes(request.method)

      &&

      isJsonRequest(request)

    ) {


      try {


        const cloned =
          request.clone();



        const json =
          await cloned.json();



        if (
          json?.stream === true
        ) {

          isStream =
            true;

        }



        body =
          JSON.stringify(json);



        headers.set(

          'content-type',

          'application/json; charset=utf-8'

        );



      } catch (error) {

        // Keep original body

      }

    }




    /*
     * SSE detection fallback
     */

    const accept =
      (
        request.headers
          .get('accept')
        ||
        ''
      )
      .toLowerCase();



    if (

      accept.includes(
        'text/event-stream'
      )

    ) {

      isStream =
        true;

    }




    /*
     * 5. Timeout control
     */

    const timeoutMs =
      isStream

        ? 600_000

        : 60_000;



    const controller =
      new AbortController();



    const timeoutId =
      setTimeout(

        () =>
          controller.abort(),

        timeoutMs

      );




    try {



      /*
       * 6. Forward request
       */

      const upstreamRequest =
        new Request(

          url.toString(),

          {

            method:
              request.method,


            headers,


            body,


            redirect:
              'follow',


            signal:
              controller.signal,

          }

        );



      const response =
        await fetch(upstreamRequest);



      clearTimeout(timeoutId);




      /*
       * 7. Response headers
       */

      const responseHeaders =
        new Headers(response.headers);



      responseHeaders.set(

        'Access-Control-Allow-Origin',

        '*'

      );




      /*
       * 8. SSE optimization
       */

      const contentType =

        (

          responseHeaders
            .get('content-type')
          ||
          ''

        )
        .toLowerCase();



      if (

        contentType.includes(
          'text/event-stream'
        )

      ) {


        responseHeaders.set(

          'Content-Type',

          'text/event-stream; charset=utf-8'

        );


        responseHeaders.delete(
          'content-encoding'
        );


        responseHeaders.set(

          'Content-Encoding',

          'identity'

        );


        responseHeaders.set(

          'Cache-Control',

          'no-cache, no-transform'

        );


        responseHeaders.set(

          'Connection',

          'keep-alive'

        );


        responseHeaders.set(

          'X-Accel-Buffering',

          'no'

        );

      }




      /*
       * Let Worker handle framing
       */

      responseHeaders.delete(
        'content-length'
      );


      responseHeaders.delete(
        'transfer-encoding'
      );




      return new Response(

        response.body,

        {

          status:
            response.status,


          headers:
            responseHeaders,

        }

      );




    } catch (error) {



      clearTimeout(timeoutId);



      const errorId =
        crypto.randomUUID();



      console.error(

        `[${errorId}] Proxy error`,

        {

          name:
            error.name,


          message:
            error.message,


          path:
            pathname,


          method:
            request.method,

        }

      );




      return new Response(

        JSON.stringify({

          error:

            error.name === 'AbortError'

              ? 'Request timeout'

              : 'Proxy failed',


          errorId,


          path:
            pathname,

        }),


        {

          status:

            error.name === 'AbortError'

              ? 504

              : 500,


          headers: {

            'Content-Type':
              'application/json',

          },

        }

      );


    }

  },

};
