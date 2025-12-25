import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_PROTOCOLS = ["javascript:", "file:", "data:", "blob:"];

// User-Agent rotation pool - realistic browser fingerprints
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
];

// Client hints for Chrome browsers
const CLIENT_HINTS = {
  "Sec-CH-UA": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Sec-CH-UA-Platform-Version": '"15.0.0"',
  "Sec-CH-UA-Full-Version-List": '"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.130", "Google Chrome";v="120.0.6099.130"',
};

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

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

    // Fetch the target URL with enhanced headers
    console.log(`Fetching: ${url} (type: ${type || 'page'})`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const userAgent = getRandomUserAgent();
    const isChrome = userAgent.includes("Chrome");

    // Build request headers - mimic real browser
    const requestHeaders: Record<string, string> = {
      "User-Agent": userAgent,
      "Accept": type === "resource" 
        ? "*/*" 
        : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      // Navigation headers
      "Sec-Fetch-Dest": type === "resource" ? "empty" : "document",
      "Sec-Fetch-Mode": type === "resource" ? "cors" : "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      // Referer spoofing
      "Referer": targetUrl.origin + "/",
      "Origin": targetUrl.origin,
    };

    // Add client hints for Chrome
    if (isChrome) {
      Object.assign(requestHeaders, CLIENT_HINTS);
    }

    const response = await fetch(url, {
      headers: requestHeaders,
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
    const processedContent = processHtml(content, baseUrl, targetUrl.protocol, url, targetUrl.hostname);

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

function processHtml(html: string, baseUrl: string, protocol: string, originalUrl: string, hostname: string): string {
  let processed = html;
  
  // Remove ALL security headers and CSP that block iframe embedding
  processed = processed.replace(
    /<meta[^>]*http-equiv=["']?(Content-Security-Policy|X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Referrer-Policy)["']?[^>]*>/gi,
    ""
  );
  
  // Remove CSP meta tags more aggressively
  processed = processed.replace(/<meta[^>]*content-security-policy[^>]*>/gi, "");
  processed = processed.replace(/<meta[^>]*name=["']?referrer["']?[^>]*>/gi, "");
  
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
  processed = processed.replace(/srcset=["'][^"']*\/\//g, (match) => match.replace(/\/\//, `${protocol}//`));
  
  // Fix integrity attributes that can block resources
  processed = processed.replace(/\s+integrity=["'][^"']*["']/gi, "");
  processed = processed.replace(/\s+crossorigin=["'][^"']*["']/gi, "");
  
  // Inject comprehensive anti-detection script
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
        'use strict';
        
        const PROXY_BASE = window.location.origin;
        const ORIGINAL_URL = "${originalUrl}";
        const BASE_URL = "${baseUrl}";
        const TARGET_HOSTNAME = "${hostname}";
        const TARGET_ORIGIN = "${baseUrl}";
        const TARGET_PROTOCOL = "${protocol}";
        
        // ============================================
        // PHASE 1: Anti-Fingerprinting & Environment Spoofing
        // ============================================
        
        // Hide webdriver detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });
        
        // Spoof plugins to look like real browser
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
            ];
            plugins.length = 3;
            return plugins;
          },
          configurable: true
        });
        
        // Spoof languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
          configurable: true
        });
        
        // Hide automation indicators
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        
        // ============================================
        // PHASE 2: Location & Document Spoofing
        // ============================================
        
        // Create fake location object
        const fakeLocation = {
          href: ORIGINAL_URL,
          origin: TARGET_ORIGIN,
          protocol: TARGET_PROTOCOL,
          host: TARGET_HOSTNAME,
          hostname: TARGET_HOSTNAME,
          port: '',
          pathname: new URL(ORIGINAL_URL).pathname,
          search: new URL(ORIGINAL_URL).search,
          hash: new URL(ORIGINAL_URL).hash,
          ancestorOrigins: { length: 0 },
          assign: function(url) { 
            const resolved = resolveUrl(url);
            if (window.parent !== window) {
              window.parent.postMessage({ type: 'proxy-navigate', url: resolved }, '*');
            }
          },
          reload: function() { 
            if (window.parent !== window) {
              window.parent.postMessage({ type: 'proxy-navigate', url: ORIGINAL_URL }, '*');
            }
          },
          replace: function(url) { 
            const resolved = resolveUrl(url);
            if (window.parent !== window) {
              window.parent.postMessage({ type: 'proxy-navigate', url: resolved }, '*');
            }
          },
          toString: function() { return ORIGINAL_URL; }
        };
        
        // Try to spoof document.location (may not work in all contexts)
        try {
          Object.defineProperty(document, 'location', {
            get: () => fakeLocation,
            configurable: true
          });
        } catch(e) {}
        
        // Spoof document properties
        try {
          Object.defineProperty(document, 'domain', {
            get: () => TARGET_HOSTNAME,
            set: () => {},
            configurable: true
          });
        } catch(e) {}
        
        try {
          Object.defineProperty(document, 'URL', {
            get: () => ORIGINAL_URL,
            configurable: true
          });
        } catch(e) {}
        
        try {
          Object.defineProperty(document, 'documentURI', {
            get: () => ORIGINAL_URL,
            configurable: true
          });
        } catch(e) {}
        
        try {
          Object.defineProperty(document, 'baseURI', {
            get: () => ORIGINAL_URL,
            configurable: true
          });
        } catch(e) {}
        
        try {
          Object.defineProperty(document, 'referrer', {
            get: () => '',
            configurable: true
          });
        } catch(e) {}
        
        // ============================================
        // PHASE 3: Iframe Detection Hiding
        // ============================================
        
        // Make it look like we're not in an iframe
        try {
          Object.defineProperty(window, 'top', {
            get: () => window,
            configurable: true
          });
        } catch(e) {}
        
        try {
          Object.defineProperty(window, 'parent', {
            get: () => window,
            configurable: true
          });
        } catch(e) {}
        
        try {
          Object.defineProperty(window, 'frameElement', {
            get: () => null,
            configurable: true
          });
        } catch(e) {}
        
        try {
          Object.defineProperty(window, 'self', {
            get: () => window,
            configurable: true
          });
        } catch(e) {}
        
        // Override window.frames
        try {
          Object.defineProperty(window, 'frames', {
            get: () => window,
            configurable: true
          });
        } catch(e) {}
        
        // ============================================
        // PHASE 4: Service Worker Blocking
        // ============================================
        
        // Block service worker registration to prevent bypass
        if ('serviceWorker' in navigator) {
          const originalRegister = navigator.serviceWorker.register;
          navigator.serviceWorker.register = function() {
            console.log('[Proxy] Service worker registration blocked');
            return Promise.reject(new DOMException('Service workers are not supported', 'SecurityError'));
          };
        }
        
        // ============================================
        // PHASE 5: URL Resolution & Proxy Helpers
        // ============================================
        
        function resolveUrl(url) {
          if (!url || typeof url !== 'string') return url;
          if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('#')) {
            return url;
          }
          try {
            if (url.startsWith('//')) {
              return TARGET_PROTOCOL + url;
            }
            if (url.startsWith('/')) {
              return BASE_URL + url;
            }
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              return new URL(url, ORIGINAL_URL).href;
            }
            return url;
          } catch(e) {
            return url;
          }
        }
        
        function proxyUrl(url) {
          const resolved = resolveUrl(url);
          if (!resolved || resolved.startsWith('data:') || resolved.startsWith('blob:') || resolved.startsWith('javascript:') || resolved.startsWith('#')) {
            return resolved;
          }
          return '/browse/' + encodeURIComponent(resolved);
        }
        
        // Expose for debugging
        window.__proxyResolveUrl = resolveUrl;
        window.__proxyUrl = proxyUrl;
        
        // ============================================
        // PHASE 6: Fetch & XHR Interception
        // ============================================
        
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
          const resolved = resolveUrl(url);
          
          // Clone init and modify
          const newInit = init ? { ...init } : {};
          
          // Fix credentials and mode
          if (!newInit.credentials) newInit.credentials = 'include';
          if (newInit.mode === 'same-origin') newInit.mode = 'cors';
          
          if (typeof input === 'string') {
            return originalFetch.call(this, resolved, newInit);
          } else if (input instanceof Request) {
            const newRequest = new Request(resolved, {
              method: input.method,
              headers: input.headers,
              body: input.body,
              mode: newInit.mode || input.mode,
              credentials: newInit.credentials || input.credentials,
              cache: input.cache,
              redirect: input.redirect,
              referrer: TARGET_ORIGIN,
              referrerPolicy: input.referrerPolicy,
            });
            return originalFetch.call(this, newRequest);
          }
          return originalFetch.call(this, resolved, newInit);
        };
        
        // Override XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
          this._proxyUrl = resolveUrl(url);
          return originalXHROpen.call(this, method, this._proxyUrl, async !== false, user, password);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
          // Set withCredentials for cross-origin requests
          try {
            this.withCredentials = true;
          } catch(e) {}
          return originalXHRSend.call(this, body);
        };
        
        // ============================================
        // PHASE 7: Dynamic Element Creation Interception
        // ============================================
        
        const originalCreateElement = document.createElement.bind(document);
        document.createElement = function(tagName, options) {
          const element = originalCreateElement(tagName, options);
          const tag = tagName.toLowerCase();
          
          if (['script', 'img', 'link', 'iframe', 'video', 'audio', 'source', 'embed', 'object'].includes(tag)) {
            const originalSetAttribute = element.setAttribute.bind(element);
            
            element.setAttribute = function(name, value) {
              if (['src', 'href', 'data', 'poster', 'action'].includes(name) && value) {
                value = resolveUrl(value);
              }
              return originalSetAttribute(name, value);
            };
            
            // Intercept property setters
            const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src') ||
                                  Object.getOwnPropertyDescriptor(element.constructor.prototype, 'src');
            
            if (tag === 'script' || tag === 'img' || tag === 'iframe' || tag === 'video' || tag === 'audio' || tag === 'embed' || tag === 'source') {
              Object.defineProperty(element, 'src', {
                set: function(value) {
                  const resolved = resolveUrl(value);
                  originalSetAttribute('src', resolved);
                },
                get: function() {
                  return element.getAttribute('src');
                },
                configurable: true
              });
            }
            
            if (tag === 'link') {
              Object.defineProperty(element, 'href', {
                set: function(value) {
                  const resolved = resolveUrl(value);
                  originalSetAttribute('href', resolved);
                },
                get: function() {
                  return element.getAttribute('href');
                },
                configurable: true
              });
            }
          }
          return element;
        };
        
        // Override Image constructor
        const OriginalImage = window.Image;
        window.Image = function(width, height) {
          const img = new OriginalImage(width, height);
          const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
          
          Object.defineProperty(img, 'src', {
            set: function(value) {
              const resolved = resolveUrl(value);
              if (originalSrcDescriptor && originalSrcDescriptor.set) {
                originalSrcDescriptor.set.call(this, resolved);
              } else {
                this.setAttribute('src', resolved);
              }
            },
            get: function() {
              if (originalSrcDescriptor && originalSrcDescriptor.get) {
                return originalSrcDescriptor.get.call(this);
              }
              return this.getAttribute('src');
            },
            configurable: true
          });
          
          return img;
        };
        window.Image.prototype = OriginalImage.prototype;
        
        // Override Audio constructor
        const OriginalAudio = window.Audio;
        if (OriginalAudio) {
          window.Audio = function(src) {
            const resolved = src ? resolveUrl(src) : undefined;
            return new OriginalAudio(resolved);
          };
          window.Audio.prototype = OriginalAudio.prototype;
        }
        
        // ============================================
        // PHASE 8: WebSocket Wrapper
        // ============================================
        
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
          // Convert ws:// to wss:// if needed and resolve URL
          let wsUrl = url;
          if (url.startsWith('ws://') || url.startsWith('wss://')) {
            // WebSockets need to go directly to the target for now
            // Full WebSocket proxying would require a separate WebSocket server
            console.log('[Proxy] WebSocket connection:', url);
          } else if (url.startsWith('//')) {
            wsUrl = 'wss:' + url;
          } else if (url.startsWith('/')) {
            wsUrl = 'wss://' + TARGET_HOSTNAME + url;
          }
          return new OriginalWebSocket(wsUrl, protocols);
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
        window.WebSocket.OPEN = OriginalWebSocket.OPEN;
        window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
        window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
        
        // ============================================
        // PHASE 9: Worker Interception
        // ============================================
        
        const OriginalWorker = window.Worker;
        if (OriginalWorker) {
          window.Worker = function(scriptURL, options) {
            const resolved = resolveUrl(scriptURL);
            console.log('[Proxy] Worker created:', resolved);
            return new OriginalWorker(resolved, options);
          };
          window.Worker.prototype = OriginalWorker.prototype;
        }
        
        const OriginalSharedWorker = window.SharedWorker;
        if (OriginalSharedWorker) {
          window.SharedWorker = function(scriptURL, options) {
            const resolved = resolveUrl(scriptURL);
            console.log('[Proxy] SharedWorker created:', resolved);
            return new OriginalSharedWorker(resolved, options);
          };
          window.SharedWorker.prototype = OriginalSharedWorker.prototype;
        }
        
        // ============================================
        // PHASE 10: Navigation Interception
        // ============================================
        
        // Real parent reference for messaging
        const realParent = window.parent;
        
        // Intercept link clicks
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a[href]');
          if (link) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
              e.preventDefault();
              e.stopPropagation();
              const resolved = resolveUrl(href);
              
              const target = link.getAttribute('target');
              const isNewTab = target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey;
              
              realParent.postMessage({
                type: 'proxy-navigate',
                url: resolved,
                newTab: isNewTab
              }, '*');
            }
          }
        }, true);
        
        // Intercept form submissions
        document.addEventListener('submit', function(e) {
          const form = e.target;
          if (form.tagName === 'FORM') {
            const action = form.getAttribute('action') || ORIGINAL_URL;
            const method = (form.getAttribute('method') || 'GET').toUpperCase();
            
            if (method === 'GET') {
              e.preventDefault();
              const formData = new FormData(form);
              const params = new URLSearchParams(formData);
              const resolved = resolveUrl(action);
              const urlWithParams = resolved + (resolved.includes('?') ? '&' : '?') + params.toString();
              
              realParent.postMessage({
                type: 'proxy-navigate',
                url: urlWithParams
              }, '*');
            } else {
              // For POST forms, update action URL
              form.setAttribute('action', resolveUrl(action));
            }
          }
        }, true);
        
        // Override window.open
        const originalWindowOpen = window.open;
        window.open = function(url, target, features) {
          if (url) {
            const resolved = resolveUrl(url);
            realParent.postMessage({
              type: 'proxy-navigate',
              url: resolved,
              newTab: true
            }, '*');
            return null;
          }
          return originalWindowOpen.call(this, url, target, features);
        };
        
        // Override location.href setter
        try {
          const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
          if (locationDescriptor && locationDescriptor.set) {
            const originalLocationSetter = locationDescriptor.set;
            Object.defineProperty(window, 'location', {
              get: () => fakeLocation,
              set: function(value) {
                const resolved = resolveUrl(value);
                realParent.postMessage({ type: 'proxy-navigate', url: resolved }, '*');
              },
              configurable: true
            });
          }
        } catch(e) {}
        
        // ============================================
        // PHASE 11: History API Override
        // ============================================
        
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, title, url) {
          if (url) {
            const resolved = resolveUrl(url);
            realParent.postMessage({
              type: 'proxy-url-change',
              url: resolved
            }, '*');
            // Update our fake location
            try {
              fakeLocation.href = resolved;
              fakeLocation.pathname = new URL(resolved).pathname;
              fakeLocation.search = new URL(resolved).search;
              fakeLocation.hash = new URL(resolved).hash;
            } catch(e) {}
          }
          return originalPushState.call(this, state, title, url);
        };
        
        history.replaceState = function(state, title, url) {
          if (url) {
            const resolved = resolveUrl(url);
            realParent.postMessage({
              type: 'proxy-url-change',
              url: resolved
            }, '*');
            try {
              fakeLocation.href = resolved;
              fakeLocation.pathname = new URL(resolved).pathname;
              fakeLocation.search = new URL(resolved).search;
              fakeLocation.hash = new URL(resolved).hash;
            } catch(e) {}
          }
          return originalReplaceState.call(this, state, title, url);
        };
        
        window.addEventListener('popstate', function(e) {
          realParent.postMessage({
            type: 'proxy-url-change',
            url: window.location.href
          }, '*');
        });
        
        // ============================================
        // PHASE 12: PostMessage Interception
        // ============================================
        
        // Make postMessage work with our spoofed origin
        const originalPostMessage = window.postMessage;
        window.postMessage = function(message, targetOrigin, transfer) {
          // Allow all origins since we're proxying
          if (targetOrigin === TARGET_ORIGIN || targetOrigin === '*') {
            return originalPostMessage.call(this, message, '*', transfer);
          }
          return originalPostMessage.call(this, message, targetOrigin, transfer);
        };
        
        // ============================================
        // PHASE 13: Cookie & Storage Handling
        // ============================================
        
        // Override document.cookie to handle cross-origin cookies
        const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
        if (originalCookieDescriptor) {
          Object.defineProperty(document, 'cookie', {
            get: function() {
              return originalCookieDescriptor.get.call(this);
            },
            set: function(value) {
              // Remove domain restrictions from cookies
              let modifiedCookie = value.replace(/;\\s*domain=[^;]*/gi, '');
              modifiedCookie = modifiedCookie.replace(/;\\s*secure/gi, '');
              modifiedCookie = modifiedCookie.replace(/;\\s*samesite=[^;]*/gi, '');
              return originalCookieDescriptor.set.call(this, modifiedCookie);
            },
            configurable: true
          });
        }
        
        console.log('[Proxy] Advanced anti-detection loaded for:', TARGET_HOSTNAME);
      })();
    </script>
  `;
  
  // Inject before </head> or at the start
  if (processed.match(/<\/head>/i)) {
    processed = processed.replace(/<\/head>/i, `${injection}</head>`);
  } else if (processed.match(/<body[^>]*>/i)) {
    processed = processed.replace(/<body([^>]*)>/i, `${injection}<body$1>`);
  } else {
    processed = injection + processed;
  }
  
  return processed;
}
