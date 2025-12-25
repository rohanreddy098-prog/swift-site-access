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

  // Load bare-mux dynamically at runtime (not during build)
  await initializeBareMux(wispUrl);

  console.log("[UV] Service Worker registered and connected to Wisp server:", wispUrl);
  
  return registration;
}

/**
 * Initialize bare-mux connection to Wisp server
 */
async function initializeBareMux(wispUrl: string): Promise<void> {
  // Use dynamic import with a full URL to load from public folder at runtime
  const bareMuxModule = await loadScript("/baremux/bare.mjs");
  
  if (bareMuxModule && (bareMuxModule as { BareMux?: unknown }).BareMux) {
    const BareMux = (bareMuxModule as { BareMux: new (workerPath: string) => { setTransport: (transport: string, options: unknown[]) => Promise<void> } }).BareMux;
    const connection = new BareMux("/baremux/worker.js");
    await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
  } else {
    console.warn("[UV] BareMux not available, using fallback mode");
  }
}

/**
 * Load a script as an ES module dynamically
 */
async function loadScript(src: string): Promise<unknown> {
  try {
    // Create a blob URL to avoid Vite's module resolution
    const response = await fetch(src);
    const text = await response.text();
    const blob = new Blob([text], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const module = await import(/* @vite-ignore */ blobUrl);
    URL.revokeObjectURL(blobUrl);
    return module;
  } catch (error) {
    console.error("[UV] Failed to load module:", src, error);
    return null;
  }
}

/**
 * Encodes a URL for the Ultraviolet proxy using XOR encoding
 */
export function encodeProxyUrl(url: string): string {
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
