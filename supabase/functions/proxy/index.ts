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

  try {
    const { url } = await req.json();
    
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

    // Check blocked domains
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: blocked } = await supabase
      .from("blocked_domains")
      .select("domain")
      .eq("domain", targetUrl.hostname)
      .maybeSingle();

    if (blocked) {
      return new Response(JSON.stringify({ error: "This domain is blocked" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check maintenance mode
    const { data: maintenance } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();

    if (maintenance?.value === "true") {
      return new Response(JSON.stringify({ error: "Service is under maintenance" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the target URL with better headers
    console.log(`Proxying request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    const content = await response.text();

    // Log request for analytics (fire and forget)
    supabase.from("proxy_requests").insert({
      target_url: url,
      status_code: response.status,
      response_size: content.length,
      user_agent: req.headers.get("user-agent"),
    });

    // Rewrite URLs in HTML content
    let processedContent = content;
    if (contentType.includes("text/html")) {
      const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;
      
      // Inject base tag right after opening head tag
      if (processedContent.match(/<head[^>]*>/i)) {
        processedContent = processedContent.replace(
          /<head([^>]*)>/i,
          `<head$1><base href="${baseUrl}/" target="_self">`
        );
      } else {
        // If no head tag, add one
        processedContent = `<head><base href="${baseUrl}/" target="_self"></head>` + processedContent;
      }
      
      // Remove Content-Security-Policy meta tags that might block content
      processedContent = processedContent.replace(
        /<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
        ""
      );
      
      // Remove X-Frame-Options meta tags
      processedContent = processedContent.replace(
        /<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi,
        ""
      );
      
      // Fix protocol-relative URLs
      processedContent = processedContent.replace(
        /src=["']\/\//g,
        `src="${targetUrl.protocol}//`
      );
      processedContent = processedContent.replace(
        /href=["']\/\//g,
        `href="${targetUrl.protocol}//`
      );
      
      // Fix relative URLs that start with /
      processedContent = processedContent.replace(
        /src=["']\//g,
        `src="${baseUrl}/`
      );
      processedContent = processedContent.replace(
        /href=["']\//g,
        `href="${baseUrl}/`
      );
      
      // Fix srcset attributes
      processedContent = processedContent.replace(
        /srcset=["']([^"']+)["']/gi,
        (match, srcset) => {
          const fixedSrcset = srcset.replace(/(^|\s)\/(?!\/)/g, `$1${baseUrl}/`);
          return `srcset="${fixedSrcset}"`;
        }
      );
      
      // Add CSS to handle body/html sizing for proper iframe display
      const styleInjection = `
        <style>
          html, body { 
            margin: 0 !important; 
            padding: 0 !important;
            min-height: 100vh !important;
            overflow-x: hidden !important;
          }
        </style>
      `;
      
      // Inject script to handle relative URLs in dynamically loaded content
      const scriptInjection = `
        <script>
          (function() {
            var baseUrl = "${baseUrl}";
            
            // Override fetch to handle relative URLs
            var originalFetch = window.fetch;
            window.fetch = function(url, options) {
              if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
                url = baseUrl + url;
              }
              return originalFetch.call(this, url, options);
            };
            
            // Override XMLHttpRequest
            var originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
                url = baseUrl + url;
              }
              return originalOpen.apply(this, [method, url, ...Array.prototype.slice.call(arguments, 2)]);
            };
          })();
        </script>
      `;
      
      if (processedContent.match(/<\/head>/i)) {
        processedContent = processedContent.replace(
          /<\/head>/i,
          `${styleInjection}${scriptInjection}</head>`
        );
      }
    }

    return new Response(
      JSON.stringify({ content: processedContent, status: response.status }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Proxy error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch website";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
