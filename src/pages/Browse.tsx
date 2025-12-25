import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { LoadingBar } from "@/components/proxy/LoadingBar";
import { BrowserToolbar } from "@/components/proxy/BrowserToolbar";
import { AlertTriangle, RefreshCw, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { registerServiceWorker, encodeProxyUrl } from "@/lib/registerServiceWorker";

// Wisp server URL - will be set from environment or default
const WISP_SERVER_URL = import.meta.env.VITE_WISP_SERVER_URL || "";

const Browse = () => {
  const { url } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [pageTitle, setPageTitle] = useState<string>("");
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // History tracking
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const decodedUrl = url ? decodeURIComponent(url) : "";

  // Initialize Service Worker
  useEffect(() => {
    async function initServiceWorker() {
      if (!WISP_SERVER_URL) {
        setError("Wisp server URL not configured. Please set VITE_WISP_SERVER_URL environment variable.");
        setIsLoading(false);
        return;
      }

      try {
        console.log("[Browse] Initializing Ultraviolet Service Worker...");
        await registerServiceWorker(WISP_SERVER_URL);
        setSwReady(true);
        console.log("[Browse] Service Worker ready!");
      } catch (err) {
        console.error("[Browse] Service Worker initialization failed:", err);
        setError(`Failed to initialize proxy: ${err instanceof Error ? err.message : "Unknown error"}`);
        setIsLoading(false);
      }
    }

    initServiceWorker();
  }, []);

  // Load content when SW is ready and URL changes
  useEffect(() => {
    if (!decodedUrl) {
      navigate("/");
      return;
    }

    if (!swReady) return;

    setIsLoading(true);
    setError(null);
    setCurrentUrl(decodedUrl);
    setPageTitle("");

    try {
      // Encode URL for Ultraviolet proxy
      const encodedUrl = encodeProxyUrl(decodedUrl);
      setProxyUrl(encodedUrl);
      
      // Add to history
      if (history.length === 0 || history[historyIndex] !== decodedUrl) {
        setHistory(prev => {
          const newHistory = [...prev.slice(0, historyIndex + 1), decodedUrl];
          return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load website";
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  }, [decodedUrl, navigate, swReady]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    
    // Try to get page title from iframe
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentDocument?.title) {
        setPageTitle(iframe.contentDocument.title);
      }
    } catch {
      // Cross-origin restrictions prevent access
    }
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setError("Failed to load the website. The site may be blocking proxy access.");
  }, []);

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevUrl = history[newIndex];
      navigate(`/browse/${encodeURIComponent(prevUrl)}`, { replace: true });
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextUrl = history[newIndex];
      navigate(`/browse/${encodeURIComponent(nextUrl)}`, { replace: true });
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && proxyUrl) {
      setIsLoading(true);
      iframeRef.current.src = proxyUrl;
    }
  };

  const handleHome = () => {
    navigate("/");
  };

  const handleNavigate = (newUrl: string) => {
    navigate(`/browse/${encodeURIComponent(newUrl)}`);
  };

  const handleClose = () => {
    navigate("/");
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      <LoadingBar isLoading={isLoading} className="fixed top-0 left-0 right-0 z-50" />
      
      {/* Browser Toolbar */}
      <BrowserToolbar
        currentUrl={currentUrl || decodedUrl}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onRefresh={handleRefresh}
        onHome={handleHome}
        onClose={handleClose}
        canGoBack={historyIndex > 0}
        canGoForward={historyIndex < history.length - 1}
        isLoading={isLoading}
        pageTitle={pageTitle}
      />

      {/* Content area */}
      <div className="flex-1 overflow-hidden bg-white">
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-zinc-950">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
            <p className="text-zinc-400">
              {swReady ? "Loading website..." : "Initializing proxy..."}
            </p>
            <p className="text-sm text-zinc-600">
              {swReady ? `Fetching ${currentUrl || decodedUrl}` : "Connecting to Wisp server..."}
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4 bg-zinc-950">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-zinc-200">Unable to Load Website</h2>
              <p className="text-zinc-400 max-w-md mb-4">{error}</p>
              {!WISP_SERVER_URL && (
                <div className="text-sm text-zinc-600 bg-zinc-900 p-4 rounded-lg max-w-lg mb-4">
                  <p className="font-semibold mb-2">Setup Required:</p>
                  <ol className="list-decimal list-inside text-left space-y-1">
                    <li>Deploy a Wisp server on Railway or VPS</li>
                    <li>Add VITE_WISP_SERVER_URL secret with the Wisp URL</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={() => navigate("/")}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              {WISP_SERVER_URL && (
                <Button 
                  onClick={handleRefresh}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
              <a href={currentUrl || decodedUrl} target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="secondary"
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Directly
                </Button>
              </a>
            </div>
          </div>
        )}

        {!error && proxyUrl && swReady && (
          <iframe
            ref={iframeRef}
            src={proxyUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="Proxied content"
          />
        )}
      </div>
    </div>
  );
};

export default Browse;
