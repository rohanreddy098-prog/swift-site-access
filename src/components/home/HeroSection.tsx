import { UrlInput } from "@/components/proxy/UrlInput";
import { Shield, Zap, Lock, Globe } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl" />
      </div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Secure & Private Browsing</span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in-up">
            Browse the Web
            <br />
            <span className="gradient-text">Without Limits</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Access any website instantly and securely. Your gateway to unrestricted internet with privacy-first technology.
          </p>

          {/* URL Input */}
          <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <UrlInput />
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <div className="flex flex-col items-center gap-2 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium">Lightning Fast</span>
              <span className="text-sm text-muted-foreground">Optimized for speed</span>
            </div>
            
            <div className="flex flex-col items-center gap-2 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium">Encrypted</span>
              <span className="text-sm text-muted-foreground">End-to-end security</span>
            </div>
            
            <div className="flex flex-col items-center gap-2 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium">Any Website</span>
              <span className="text-sm text-muted-foreground">No restrictions</span>
            </div>
            
            <div className="flex flex-col items-center gap-2 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <span className="font-medium">No Logs</span>
              <span className="text-sm text-muted-foreground">Privacy guaranteed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
