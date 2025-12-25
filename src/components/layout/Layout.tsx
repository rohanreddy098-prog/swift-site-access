import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { AdBanner } from "@/components/ads/AdBanner";

interface LayoutProps {
  children: ReactNode;
  showAds?: boolean;
}

export function Layout({ children, showAds = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {showAds && <AdBanner position="top" />}
      <main className="flex-1 pt-16">
        {children}
      </main>
      {showAds && <AdBanner position="bottom" />}
      <Footer />
    </div>
  );
}
