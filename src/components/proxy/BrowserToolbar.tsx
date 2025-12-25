import { useState, useEffect, KeyboardEvent } from "react";
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Home, 
  Lock, 
  Maximize2,
  ExternalLink,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BrowserToolbarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onHome: () => void;
  onClose: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  pageTitle?: string;
}

export function BrowserToolbar({
  currentUrl,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onHome,
  onClose,
  canGoBack,
  canGoForward,
  isLoading,
  pageTitle,
}: BrowserToolbarProps) {
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setUrlInput(currentUrl);
  }, [currentUrl]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      let url = urlInput.trim();
      if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      if (url) {
        onNavigate(url);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const isHttps = currentUrl.startsWith("https://");

  const displayUrl = (() => {
    try {
      return new URL(currentUrl).hostname;
    } catch {
      return currentUrl;
    }
  })();

  return (
    <div className="bg-zinc-900 border-b border-zinc-800">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-1.5 max-w-md">
            <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-sm text-zinc-200 truncate">
              {pageTitle || displayUrl || "New Tab"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-1 px-2 py-2">
        {/* Navigation buttons */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 rounded-full",
              canGoBack 
                ? "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800" 
                : "text-zinc-600 cursor-not-allowed"
            )}
            onClick={onBack}
            disabled={!canGoBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 rounded-full",
              canGoForward 
                ? "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800" 
                : "text-zinc-600 cursor-not-allowed"
            )}
            onClick={onForward}
            disabled={!canGoForward}
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 rounded-full text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800",
              isLoading && "animate-spin"
            )}
            onClick={onRefresh}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={onHome}
          >
            <Home className="w-4 h-4" />
          </Button>
        </div>

        {/* URL Bar */}
        <div className="flex-1 mx-2">
          <div className="relative flex items-center">
            <div className="absolute left-3 flex items-center pointer-events-none">
              {isHttps ? (
                <Lock className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </div>
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 pl-9 pr-10 bg-zinc-800 border-zinc-700 text-zinc-200 text-sm rounded-full focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-zinc-500"
              placeholder="Search or enter URL"
            />
            {isLoading && (
              <div className="absolute right-3">
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
