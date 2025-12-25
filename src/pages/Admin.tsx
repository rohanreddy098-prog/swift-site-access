import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Users, Globe, Shield, Settings, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const Admin = () => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      toast.error("Access denied");
      navigate("/");
    }
  }, [user, isAdmin, isLoading, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: todayRequests } = await supabase
        .from("proxy_requests")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());

      const { data: totalBandwidth } = await supabase
        .from("proxy_requests")
        .select("response_size");

      const bandwidth = totalBandwidth?.reduce((acc, r) => acc + (r.response_size || 0), 0) || 0;

      const { count: blockedCount } = await supabase
        .from("blocked_domains")
        .select("*", { count: "exact", head: true });

      return {
        todayRequests: todayRequests || 0,
        bandwidth: (bandwidth / 1024 / 1024).toFixed(2),
        blockedDomains: blockedCount || 0,
      };
    },
    enabled: isAdmin,
  });

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      return data?.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>) || {};
    },
    enabled: isAdmin,
  });

  const toggleSetting = async (key: string) => {
    const newValue = settings?.[key] === "true" ? "false" : "true";
    await supabase.from("site_settings").update({ value: newValue }).eq("key", key);
    refetchSettings();
    toast.success(`${key.replace("_", " ")} updated`);
  };

  if (isLoading || !isAdmin) return null;

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - ShuttleProxy</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Admin Dashboard
              </h1>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.todayRequests || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Bandwidth Used</CardTitle>
                <Globe className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.bandwidth || 0} MB</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Blocked Domains</CardTitle>
                <Shield className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.blockedDomains || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Site Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show Ads</p>
                  <p className="text-sm text-muted-foreground">Display advertisement banners</p>
                </div>
                <Switch checked={settings?.ads_enabled === "true"} onCheckedChange={() => toggleSetting("ads_enabled")} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Maintenance Mode</p>
                  <p className="text-sm text-muted-foreground">Disable proxy for maintenance</p>
                </div>
                <Switch checked={settings?.maintenance_mode === "true"} onCheckedChange={() => toggleSetting("maintenance_mode")} />
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};

export default Admin;
