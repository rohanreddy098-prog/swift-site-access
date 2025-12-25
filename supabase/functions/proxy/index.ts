import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_PROTOCOLS = ["javascript:", "file:", "data:", "blob:"];

// Sites that are known to not work well with proxies
const PROBLEMATIC_SITES = [
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "instagram.com", "www.instagram.com",
  "facebook.com", "www.facebook.com", "m.facebook.com",
  "twitter.com", "www.twitter.com", "x.com", "www.x.com",
  "tiktok.com", "www.tiktok.com",
  "netflix.com", "www.netflix.com",
  "google.com", "www.google.com",
  "accounts.google.com", "login.microsoftonline.com"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // Check if site is known to be problematic
    const hostname = targetUrl.hostname.toLowerCase();
    if (PROBLEMATIC_SITES.includes(hostname)) {
      return new Response(JSON.stringify({ 
        error: `${hostname} uses advanced security measures that prevent proxy access. Try simpler websites.`,
        isBlocked: true
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Fetch the target URL with optimized headers
    console.log(`Fetching: ${url}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    const content = await response.text();
    const baseUrl = `${targetUrl.protocol}//${targetUrl.host}`;

    // Log request asynchronously (don't await)
    supabase.from("proxy_requests").insert({
      target_url: url,
      status_code: response.status,
      response_size: content.length,
      user_agent: req.headers.get("user-agent"),
    });

    // Process HTML content
    let processedContent = content;
    if (contentType.includes("text/html")) {
      processedContent = processHtml(content, baseUrl, targetUrl.protocol);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Completed in ${elapsed}ms, size: ${content.length}`);

    return new Response(
      JSON.stringify({ content: processedContent, status: response.status }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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

function processHtml(html: string, baseUrl: string, protocol: string): string {
  let processed = html;
  
  // Add base tag after head
  if (processed.match(/<head[^>]*>/i)) {
    processed = processed.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${baseUrl}/">`
    );
  } else {
    processed = `<head><base href="${baseUrl}/"></head>` + processed;
  }
  
  // Remove security headers that block iframe embedding
  processed = processed.replace(
    /<meta[^>]*http-equiv=["']?(Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi,
    ""
  );
  
  // Fix protocol-relative URLs
  processed = processed.replace(/src=["']\/\//g, `src="${protocol}//`);
  processed = processed.replace(/href=["']\/\//g, `href="${protocol}//`);
  
  // Inject minimal CSS for iframe display
  const injection = `
    <style>html,body{margin:0!important;padding:0!important;min-height:100vh}</style>
  `;
  
  if (processed.match(/<\/head>/i)) {
    processed = processed.replace(/<\/head>/i, `${injection}</head>`);
  }
  
  return processed;
}