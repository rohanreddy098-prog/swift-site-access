import { useState } from "react";
import { Shield, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProxyInfoBarProps {
  targetUrl: string;
}

export function ProxyInfoBar({ targetUrl }: ProxyInfoBarProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const displayUrl = (() => {
    try {
      const url = new URL(targetUrl);
      return url.hostname;
    } catch {
      return targetUrl;
    }
  })();

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-primary/10 backdrop-blur-sm border-b border-primary/20">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm">
            Browsing securely via <span className="font-medium text-primary">{displayUrl}</span>
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Direct Link
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsVisible(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
