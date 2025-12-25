import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const decodedUrl = url ? decodeURIComponent(url) : "";

  useEffect(() => {
    if (!decodedUrl) {
      navigate("/");
      return;
    }

    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("proxy", {
          body: { url: decodedUrl },
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // Check if the response indicates a blocked site
        if (data.status === 403 || data.content?.includes("Access denied")) {
          throw new Error("This website has blocked access from our proxy servers. Try visiting it directly.");
        }

        setContent(data.content);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load website";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [decodedUrl, navigate]);

  // Adjust iframe height after load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe && content) {
      const handleLoad = () => {
        try {
          const doc = iframe.contentDocument;
          if (doc) {
            // Try to get actual content height
            const height = Math.max(
              doc.body?.scrollHeight || 0,
              doc.documentElement?.scrollHeight || 0,
              800
            );
            iframe.style.height = `${height}px`;
          }
        } catch {
          // Cross-origin restrictions, use default height
        }
      };
      
      iframe.addEventListener("load", handleLoad);
      return () => iframe.removeEventListener("load", handleLoad);
    }
  }, [content]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LoadingBar isLoading={isLoading} className="fixed top-0 left-0 right-0 z-50" />
      
      {!isLoading && !error && <ProxyInfoBar targetUrl={decodedUrl} />}

      {/* Content area */}
      <div className="flex-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="w-16 h-16 rounded-full gradient-primary animate-pulse-glow flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-primary-foreground animate-spin" />
            </div>
            <p className="text-muted-foreground">Loading website...</p>
            <p className="text-sm text-muted-foreground/70">Fetching {decodedUrl}</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Unable to Load Website</h2>
              <p className="text-muted-foreground max-w-md mb-4">{error}</p>
              <p className="text-sm text-muted-foreground/70">
                Some websites block proxy access or have strict security policies.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <a href={decodedUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Directly
                </Button>
              </a>
            </div>
          </div>
        )}

        {!isLoading && !error && content && (
          <div className="w-full pt-12">
            <iframe
              ref={iframeRef}
              srcDoc={content}
              className="w-full min-h-screen border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              title="Proxied content"
              style={{ display: "block" }}
            />
          </div>
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
