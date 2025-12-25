import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdBannerProps {
  position: "top" | "bottom";
}

export function AdBanner({ position }: AdBannerProps) {
  const { data: adsEnabled } = useQuery({
    queryKey: ["settings", "ads_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "ads_enabled")
        .maybeSingle();
      return data?.value === "true";
    },
  });

  if (!adsEnabled) return null;

  return (
    <div className={`bg-muted/50 border-border ${position === "top" ? "border-b" : "border-t"}`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center h-16 rounded-lg bg-card border border-border">
          <p className="text-sm text-muted-foreground">
            Advertisement Placeholder - {position === "top" ? "Top" : "Bottom"} Banner
          </p>
        </div>
      </div>
    </div>
  );
}
