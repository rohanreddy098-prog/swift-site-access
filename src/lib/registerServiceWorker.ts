/**
 * Registers the Ultraviolet Service Worker and connects to the Wisp server
 */
export async function registerServiceWorker(wispUrl: string): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Workers are not supported in this browser");
  }

  // Register the service worker with the /service/ scope
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/service/",
    updateViaCache: "none",
  });

  // Wait for the service worker to be ready
  await navigator.serviceWorker.ready;

  // Dynamically import bare-mux and connect to Wisp server
  // @ts-ignore - bare-mux is loaded from static files
  const { BareMux } = await import(/* @vite-ignore */ "/baremux/bare.mjs");
  const connection = new BareMux("/baremux/worker.js");
  
  // Set the transport to epoxy with the Wisp server URL
  await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);

  console.log("[UV] Service Worker registered and connected to Wisp server:", wispUrl);
  
  return registration;
}

/**
 * Encodes a URL for the Ultraviolet proxy
 */
export function encodeProxyUrl(url: string): string {
  // XOR encode the URL (same as Ultraviolet's default codec)
  const encoded = xorEncode(url);
  return "/service/" + encoded;
}

/**
 * Decodes a proxied URL back to the original
 */
export function decodeProxyUrl(encodedPath: string): string {
  const path = encodedPath.replace("/service/", "");
  return xorDecode(path);
}

// XOR encoding/decoding functions (matching Ultraviolet's codec)
function xorEncode(str: string): string {
  if (!str) return str;
  
  let result = "";
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ 2);
  }
  return encodeURIComponent(result);
}

function xorDecode(str: string): string {
  if (!str) return str;
  
  const decoded = decodeURIComponent(str);
  let result = "";
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ 2);
  }
  return result;
}
