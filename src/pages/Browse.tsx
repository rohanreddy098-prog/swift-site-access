import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { LoadingBar } from "@/components/proxy/LoadingBar";
import { BrowserToolbar } from "@/components/proxy/BrowserToolbar";
import { AlertTriangle, RefreshCw, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Browse = () => {
  const { url } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [pageTitle, setPageTitle] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // History tracking
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const decodedUrl = url ? decodeURIComponent(url) : "";

  const fetchContent = useCallback(async (targetUrl: string, addToHistory = true) => {
    setIsLoading(true);
    setError(null);
    setCurrentUrl(targetUrl);
    setPageTitle("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("proxy", {
        body: { url: targetUrl },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setContent(data.content);

      // Extract page title from content
      const titleMatch = data.content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        setPageTitle(titleMatch[1].trim());
      }

      // Add to history
      if (addToHistory) {
        setHistory(prev => {
          const newHistory = [...prev.slice(0, historyIndex + 1), targetUrl];
          return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load website";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [historyIndex]);

  useEffect(() => {
    if (!decodedUrl) {
      navigate("/");
      return;
    }

    // Initialize history with the first URL
    if (history.length === 0) {
      setHistory([decodedUrl]);
      setHistoryIndex(0);
    }

    fetchContent(decodedUrl, false);
  }, [decodedUrl, navigate]);

  // Listen for navigation messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'proxy-navigate') {
        const newUrl = event.data.url;
        console.log('[Browse] Navigation request:', newUrl);
        
        if (event.data.newTab) {
          window.open(`/browse/${encodeURIComponent(newUrl)}`, '_blank');
        } else {
          navigate(`/browse/${encodeURIComponent(newUrl)}`);
        }
      } else if (event.data?.type === 'proxy-url-change') {
        setCurrentUrl(event.data.url);
      } else if (event.data?.type === 'proxy-title-change') {
        setPageTitle(event.data.title);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

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
    if (currentUrl) {
      fetchContent(currentUrl, false);
    } else if (decodedUrl) {
      fetchContent(decodedUrl, false);
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
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-zinc-950">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
            <p className="text-zinc-400">Loading website...</p>
            <p className="text-sm text-zinc-600">Fetching {currentUrl || decodedUrl}</p>
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
              <p className="text-sm text-zinc-600">
                Some websites use advanced security that prevents proxy access.
              </p>
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
              <Button 
                onClick={handleRefresh}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
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

        {!isLoading && !error && content && (
          <iframe
            ref={iframeRef}
            srcDoc={content}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals"
            title="Proxied content"
          />
        )}
      </div>
    </div>
  );
};

export default Browse;
