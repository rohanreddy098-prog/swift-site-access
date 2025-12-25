import { Layout } from "@/components/layout/Layout";
import { FileText } from "lucide-react";
import { Helmet } from "react-helmet-async";

const Terms = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service - ShuttleProxy</title>
        <meta name="description" content="Read ShuttleProxy's terms of service to understand the rules and guidelines for using our web proxy service." />
        <link rel="canonical" href="https://shuttleproxy.com/terms" />
      </Helmet>
      <Layout>
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Terms of Service</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Terms of <span className="gradient-text">Service</span>
              </h1>
              <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Content */}
            <div className="space-y-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground">
                  By accessing and using ShuttleProxy, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                <p className="text-muted-foreground">
                  ShuttleProxy provides a web proxy service that allows users to access websites through our servers. This service is provided "as is" without any guarantees or warranties of any kind.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">3. Acceptable Use</h2>
                <p className="text-muted-foreground mb-4">You agree NOT to use our service for:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Any illegal activities or to access illegal content</li>
                  <li>Harassment, abuse, or harm to others</li>
                  <li>Distributing malware, viruses, or harmful code</li>
                  <li>Attempting to bypass security measures or exploit vulnerabilities</li>
                  <li>Scraping, automated access, or denial-of-service attacks</li>
                  <li>Any activity that violates applicable laws or regulations</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">4. Limitations</h2>
                <p className="text-muted-foreground">
                  We reserve the right to limit access, block certain domains, or terminate service to users who violate these terms or abuse our service. We may implement rate limiting to ensure fair usage for all users.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">5. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground">
                  This service is provided without warranties of any kind, either express or implied. We do not guarantee that the service will be uninterrupted, secure, or error-free. Some websites may not work properly through our proxy due to technical limitations.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">6. Limitation of Liability</h2>
                <p className="text-muted-foreground">
                  In no event shall ShuttleProxy be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of or inability to use the service.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">7. Content Responsibility</h2>
                <p className="text-muted-foreground">
                  We do not control and are not responsible for the content of websites accessed through our proxy. Users are solely responsible for the content they access and the websites they visit.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">8. Modifications</h2>
                <p className="text-muted-foreground">
                  We reserve the right to modify these terms at any time. Continued use of the service after any modifications indicates your acceptance of the updated terms.
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
                <p className="text-muted-foreground">
                  For questions about these Terms of Service, contact us at{" "}
                  <a href="mailto:legal@shuttleproxy.com" className="text-primary hover:underline">
                    legal@shuttleproxy.com
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

export default Terms;
