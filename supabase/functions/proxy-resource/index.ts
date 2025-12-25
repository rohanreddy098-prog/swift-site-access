import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// User-Agent rotation pool
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, referer } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Resource Proxy] Fetching: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const targetUrl = new URL(url);
    const userAgent = getRandomUserAgent();

    // Build request headers - mimic resource loading
    const requestHeaders: Record<string, string> = {
      "User-Agent": userAgent,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site",
      "Referer": referer || targetUrl.origin + "/",
      "Origin": targetUrl.origin,
    };

    // Add Chrome client hints
    if (userAgent.includes("Chrome")) {
      requestHeaders["Sec-CH-UA"] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
      requestHeaders["Sec-CH-UA-Mobile"] = "?0";
      requestHeaders["Sec-CH-UA-Platform"] = '"Windows"';
    }

    const response = await fetch(url, {
      headers: requestHeaders,
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");

    // For streaming, get array buffer and return as base64
    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log(`[Resource Proxy] Completed: ${url}, size: ${arrayBuffer.byteLength}, type: ${contentType}`);

    return new Response(
      JSON.stringify({
        content: base64,
        contentType,
        contentLength: contentLength ? parseInt(contentLength) : arrayBuffer.byteLength,
        isBase64: true,
        status: response.status,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        } 
      }
    );
  } catch (error: unknown) {
    console.error("[Resource Proxy] Error:", error);
    let message = "Failed to fetch resource";
    
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        message = "Request timed out";
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
