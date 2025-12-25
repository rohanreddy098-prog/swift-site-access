import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_PROTOCOLS = ["javascript:", "file:", "data:", "blob:"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { url, type } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for blocked protocols
    for (const protocol of BLOCKED_PROTOCOLS) {
      if (url.toLowerCase().startsWith(protocol)) {
        return new Response(JSON.stringify({ error: "This protocol is not allowed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Parse and validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const hostname = targetUrl.hostname.toLowerCase();

    // Check blocked domains and maintenance mode in parallel
    const [blockedResult, maintenanceResult] = await Promise.all([
      supabase
        .from("blocked_domains")
        .select("domain")
        .eq("domain", hostname)
        .maybeSingle(),
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle()
    ]);

    if (blockedResult.data) {
      return new Response(JSON.stringify({ error: "This domain is blocked" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (maintenanceResult.data?.value === "true") {
      return new Response(JSON.stringify({ error: "Service is under maintenance" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the target URL
    console.log(`Fetching: ${url} (type: ${type || 'page'})`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;

    // Log request asynchronously (don't await)
    supabase.from("proxy_requests").insert({
      target_url: url,
      status_code: response.status,
      user_agent: req.headers.get("user-agent"),
    });

    // Handle different content types
    if (type === "resource" || !contentType.includes("text/html")) {
      // Return binary/text content as base64 for resources
      const arrayBuffer = await response.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      return new Response(
        JSON.stringify({ 
          content: base64, 
          contentType,
          isBase64: true,
          status: response.status 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process HTML content
    const content = await response.text();
    const processedContent = processHtml(content, baseUrl, targetUrl.protocol, url);

    const elapsed = Date.now() - startTime;
    console.log(`Completed in ${elapsed}ms, size: ${content.length}`);

    return new Response(
      JSON.stringify({ content: processedContent, status: response.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Proxy error:", error);
    let message = "Failed to fetch website";
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        message = "Request timed out - the website took too long to respond";
      } else {
        message = error.message;
      }
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function processHtml(html: string, baseUrl: string, protocol: string, originalUrl: string): string {
  let processed = html;
  
  // Remove security headers that block iframe embedding
  processed = processed.replace(
    /<meta[^>]*http-equiv=["']?(Content-Security-Policy|X-Frame-Options|X-Content-Type-Options)["']?[^>]*>/gi,
    ""
  );
  
  // Remove CSP meta tags more aggressively
  processed = processed.replace(/<meta[^>]*content-security-policy[^>]*>/gi, "");
  
  // Add base tag after head
  const baseTag = `<base href="${baseUrl}/">`;
  if (processed.match(/<head[^>]*>/i)) {
    processed = processed.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else {
    processed = `<head>${baseTag}</head>` + processed;
  }
  
  // Fix protocol-relative URLs
  processed = processed.replace(/src=["']\/\//g, `src="${protocol}//`);
  processed = processed.replace(/href=["']\/\//g, `href="${protocol}//`);
  
  // Inject the proxy interception script and styles
  const injection = `
    <style>
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow-x: hidden;
      }
      html {
        overflow-y: auto !important;
      }
    </style>
    <script>
      (function() {
        const PROXY_BASE = window.location.origin;
        const ORIGINAL_URL = "${originalUrl}";
        const BASE_URL = "${baseUrl}";
        
        // Helper to resolve URLs
        function resolveUrl(url) {
          if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
            return url;
          }
          try {
            if (url.startsWith('//')) {
              return '${protocol}' + url;
            }
            if (url.startsWith('/')) {
              return BASE_URL + url;
            }
            if (!url.startsWith('http')) {
              return new URL(url, ORIGINAL_URL).href;
            }
            return url;
          } catch(e) {
            return url;
          }
        }
        
        // Helper to create proxy URL
        function proxyUrl(url) {
          const resolved = resolveUrl(url);
          if (!resolved || resolved.startsWith('data:') || resolved.startsWith('blob:') || resolved.startsWith('javascript:')) {
            return resolved;
          }
          return '/browse/' + encodeURIComponent(resolved);
        }
        
        // Override fetch
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          let url = typeof input === 'string' ? input : input.url;
          const resolved = resolveUrl(url);
          console.log('[Proxy] Fetch:', url, '->', resolved);
          
          if (typeof input === 'string') {
            input = resolved;
          } else {
            input = new Request(resolved, input);
          }
          return originalFetch.call(this, input, init);
        };
        
        // Override XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          const resolved = resolveUrl(url);
          console.log('[Proxy] XHR:', url, '->', resolved);
          return originalXHROpen.call(this, method, resolved, ...args);
        };
        
        // Override createElement to catch dynamic script/img/link creation
        const originalCreateElement = document.createElement.bind(document);
        document.createElement = function(tagName, options) {
          const element = originalCreateElement(tagName, options);
          const tag = tagName.toLowerCase();
          
          if (tag === 'script' || tag === 'img' || tag === 'link' || tag === 'iframe') {
            const originalSetAttribute = element.setAttribute.bind(element);
            element.setAttribute = function(name, value) {
              if ((name === 'src' || name === 'href') && value) {
                value = resolveUrl(value);
                console.log('[Proxy] Dynamic ' + tag + ':', value);
              }
              return originalSetAttribute(name, value);
            };
            
            // Also intercept property setters
            if (tag === 'script' || tag === 'img' || tag === 'iframe') {
              Object.defineProperty(element, 'src', {
                set: function(value) {
                  const resolved = resolveUrl(value);
                  console.log('[Proxy] Set src:', value, '->', resolved);
                  originalSetAttribute('src', resolved);
                },
                get: function() {
                  return element.getAttribute('src');
                }
              });
            }
          }
          return element;
        };
        
        // Intercept link clicks for navigation
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a[href]');
          if (link) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
              e.preventDefault();
              const resolved = resolveUrl(href);
              console.log('[Proxy] Click navigation:', href, '->', resolved);
              
              // Post message to parent to navigate
              if (window.parent !== window) {
                window.parent.postMessage({
                  type: 'proxy-navigate',
                  url: resolved
                }, '*');
              } else {
                window.location.href = proxyUrl(resolved);
              }
            }
          }
        }, true);
        
        // Intercept form submissions
        document.addEventListener('submit', function(e) {
          const form = e.target;
          if (form.tagName === 'FORM') {
            const action = form.getAttribute('action');
            if (action) {
              const resolved = resolveUrl(action);
              console.log('[Proxy] Form submit:', action, '->', resolved);
              form.setAttribute('action', resolved);
            }
          }
        }, true);
        
        // Override window.open
        const originalWindowOpen = window.open;
        window.open = function(url, target, features) {
          if (url) {
            const resolved = resolveUrl(url);
            console.log('[Proxy] window.open:', url, '->', resolved);
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'proxy-navigate',
                url: resolved,
                newTab: true
              }, '*');
              return null;
            }
            return originalWindowOpen.call(this, proxyUrl(resolved), target, features);
          }
          return originalWindowOpen.call(this, url, target, features);
        };
        
        // Override history methods
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, title, url) {
          if (url) {
            const resolved = resolveUrl(url);
            console.log('[Proxy] pushState:', url, '->', resolved);
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'proxy-url-change',
                url: resolved
              }, '*');
            }
          }
          return originalPushState.call(this, state, title, url);
        };
        
        history.replaceState = function(state, title, url) {
          if (url) {
            const resolved = resolveUrl(url);
            console.log('[Proxy] replaceState:', url, '->', resolved);
            if (window.parent !== window) {
              window.parent.postMessage({
                type: 'proxy-url-change', 
                url: resolved
              }, '*');
            }
          }
          return originalReplaceState.call(this, state, title, url);
        };
        
        // Handle popstate
        window.addEventListener('popstate', function(e) {
          console.log('[Proxy] popstate');
          if (window.parent !== window) {
            window.parent.postMessage({
              type: 'proxy-url-change',
              url: window.location.href
            }, '*');
          }
        });
        
        console.log('[Proxy] Interception script loaded for:', ORIGINAL_URL);
      })();
    </script>
  `;
  
  if (processed.match(/<\/head>/i)) {
    processed = processed.replace(/<\/head>/i, `${injection}</head>`);
  } else if (processed.match(/<body[^>]*>/i)) {
    processed = processed.replace(/<body([^>]*)>/i, `${injection}<body$1>`);
  } else {
    processed = injection + processed;
  }
  
  return processed;
}
