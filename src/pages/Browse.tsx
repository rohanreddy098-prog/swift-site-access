import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { LoadingBar } from "@/components/proxy/LoadingBar";
import { ProxyInfoBar } from "@/components/proxy/ProxyInfoBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Browse = () => {
  const { url } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const decodedUrl = url ? decodeURIComponent(url) : "";

  const fetchContent = useCallback(async (targetUrl: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentUrl(targetUrl);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load website";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!decodedUrl) {
      navigate("/");
      return;
    }

    fetchContent(decodedUrl);
  }, [decodedUrl, navigate, fetchContent]);

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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  const handleRefresh = () => {
    if (currentUrl) {
      fetchContent(currentUrl);
    } else if (decodedUrl) {
      fetchContent(decodedUrl);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <LoadingBar isLoading={isLoading} className="fixed top-0 left-0 right-0 z-50" />
      
      {!isLoading && !error && (
        <ProxyInfoBar targetUrl={currentUrl || decodedUrl} />
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-primary-foreground animate-spin" />
            </div>
            <p className="text-muted-foreground">Loading website...</p>
            <p className="text-sm text-muted-foreground/70">Fetching {currentUrl || decodedUrl}</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Unable to Load Website</h2>
              <p className="text-muted-foreground max-w-md mb-4">{error}</p>
              <p className="text-sm text-muted-foreground/70">
                Some websites use advanced security that prevents proxy access.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              <Button onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <a href={currentUrl || decodedUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">
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

      {/* Back button */}
      <div className="fixed bottom-6 left-6 z-40">
        <Button
          variant="secondary"
          size="sm"
          className="shadow-lg"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          New URL
        </Button>
      </div>
    </div>
  );
};

export default Browse;
