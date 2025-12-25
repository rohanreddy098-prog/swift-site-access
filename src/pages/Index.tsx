import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>ShuttleProxy - Browse the Web Without Limits</title>
        <meta name="description" content="Access any website instantly and securely with ShuttleProxy. Your gateway to unrestricted internet with privacy-first technology. Fast, encrypted, and no logs." />
        <meta name="keywords" content="web proxy, anonymous browsing, secure proxy, privacy, unblock websites" />
        <link rel="canonical" href="https://shuttleproxy.com" />
      </Helmet>
      <Layout>
        <HeroSection />
      </Layout>
    </>
  );
};

export default Index;
