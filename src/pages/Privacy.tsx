import { Layout } from "@/components/layout/Layout";
import { Shield } from "lucide-react";
import { Helmet } from "react-helmet-async";

const Privacy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy - ShuttleProxy</title>
        <meta name="description" content="ShuttleProxy's privacy policy explains how we protect your data and maintain your privacy while using our web proxy service." />
        <link rel="canonical" href="https://shuttleproxy.com/privacy" />
      </Helmet>
      <Layout>
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Privacy Policy</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Your Privacy <span className="gradient-text">Matters</span>
              </h1>
              <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <div className="bg-card border border-border rounded-2xl p-8 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Overview</h2>
                <p className="text-muted-foreground">
                  At ShuttleProxy, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your information when you use our web proxy service. We are committed to ensuring that your privacy is protected.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Information We Don't Collect</h2>
                <p className="text-muted-foreground mb-4">
                  We operate on a strict no-logs policy. This means we do NOT collect or store:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Your browsing history or the websites you visit</li>
                  <li>Your IP address in connection with your browsing activity</li>
                  <li>Cookies or tracking data from proxied websites</li>
                  <li>Personal information from the content you access</li>
                  <li>Any data that could be used to identify you personally</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Information We May Collect</h2>
                <p className="text-muted-foreground mb-4">
                  To improve our service and prevent abuse, we may collect:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Aggregate usage statistics (number of requests, not individual activity)</li>
                  <li>Rate limiting data (temporary, automatically deleted)</li>
                  <li>Account information if you choose to create an account</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
                <p className="text-muted-foreground">
                  We implement industry-standard security measures to protect any data we do process. All connections to our service are encrypted using HTTPS. We regularly audit our systems and code for security vulnerabilities.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
                <p className="text-muted-foreground">
                  When you use our proxy to access third-party websites, those websites may have their own privacy policies. We strip most tracking cookies and headers, but we cannot guarantee complete anonymity on third-party sites. We recommend reviewing the privacy policies of websites you visit.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
                <p className="text-muted-foreground mb-4">You have the right to:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Access any personal data we may hold about you</li>
                  <li>Request deletion of your account and associated data</li>
                  <li>Opt out of any optional data collection</li>
                  <li>Contact us with privacy-related questions or concerns</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have any questions about this Privacy Policy, please contact us at{" "}
                  <a href="mailto:privacy@shuttleproxy.com" className="text-primary hover:underline">
                    privacy@shuttleproxy.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
};

export default Privacy;
