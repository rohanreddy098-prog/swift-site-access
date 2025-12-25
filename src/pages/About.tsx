import { Layout } from "@/components/layout/Layout";
import { Shield, Users, Globe, Lock, Zap, Heart } from "lucide-react";
import { Helmet } from "react-helmet-async";

const About = () => {
  return (
    <>
      <Helmet>
        <title>About Us - ShuttleProxy</title>
        <meta name="description" content="Learn about ShuttleProxy's mission to provide secure, fast, and private web browsing for everyone. Discover our commitment to internet freedom." />
        <link rel="canonical" href="https://shuttleproxy.com/about" />
      </Helmet>
      <Layout>
        <div className="container mx-auto px-4 py-20">
          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">About Us</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Making the Internet
              <br />
              <span className="gradient-text">Free for Everyone</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              We believe in an open internet where everyone can access information freely and securely, regardless of their location.
            </p>
          </div>

          {/* Mission */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground mb-4">
                ShuttleProxy was founded with a simple mission: to provide everyone with secure, unrestricted access to the web. In a world where internet censorship and surveillance are increasingly common, we stand as a beacon of digital freedom.
              </p>
              <p className="text-muted-foreground">
                We've built our proxy service from the ground up with privacy and speed as our core principles. No logs, no tracking, just pure, unfiltered access to the internet you deserve.
              </p>
            </div>
            <div className="relative animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
              <div className="relative bg-card border border-border rounded-3xl p-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4">
                    <div className="text-4xl font-bold gradient-text mb-1">100K+</div>
                    <div className="text-sm text-muted-foreground">Daily Users</div>
                  </div>
                  <div className="text-center p-4">
                    <div className="text-4xl font-bold gradient-text mb-1">50M+</div>
                    <div className="text-sm text-muted-foreground">Pages Served</div>
                  </div>
                  <div className="text-center p-4">
                    <div className="text-4xl font-bold gradient-text mb-1">0</div>
                    <div className="text-sm text-muted-foreground">Logs Stored</div>
                  </div>
                  <div className="text-center p-4">
                    <div className="text-4xl font-bold gradient-text mb-1">99.9%</div>
                    <div className="text-sm text-muted-foreground">Uptime</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Values */}
          <div className="mb-20">
            <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Privacy First</h3>
                <p className="text-muted-foreground">
                  We never log your browsing activity. Your privacy is sacred, and we protect it at all costs.
                </p>
              </div>
              
              <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Speed Matters</h3>
                <p className="text-muted-foreground">
                  We've optimized every aspect of our service to deliver blazing-fast browsing experiences.
                </p>
              </div>
              
              <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Open Internet</h3>
                <p className="text-muted-foreground">
                  We believe everyone deserves unrestricted access to information, regardless of where they are.
                </p>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Heart className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Built with Love</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">By Privacy Advocates, For Everyone</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our team consists of security experts, privacy advocates, and engineers who are passionate about creating tools that empower users to take control of their online experience.
            </p>
          </div>
        </div>
      </Layout>
    </>
  );
};

export default About;
