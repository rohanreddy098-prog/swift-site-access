import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function UrlInput() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    return normalized;
  };

  const isValidUrl = (input: string): boolean => {
    try {
      new URL(normalizeUrl(input));
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    const normalizedUrl = normalizeUrl(url);
    const encodedUrl = encodeURIComponent(normalizedUrl);
    
    // Small delay for animation
    setTimeout(() => {
      navigate(`/browse/${encodedUrl}`);
    }, 300);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
        
        {/* Input container */}
        <div className="relative flex items-center bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center pl-4 text-muted-foreground">
            <Globe className="w-5 h-5" />
          </div>
          
          <Input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL..."
            className="flex-1 border-0 bg-transparent h-14 text-lg focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
          />
          
          <div className="pr-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="h-10 px-6 gradient-primary hover:opacity-90 transition-opacity"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Browse
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      <p className="text-center text-sm text-muted-foreground mt-4">
        Example: google.com, wikipedia.org, github.com
      </p>
    </form>
  );
}
