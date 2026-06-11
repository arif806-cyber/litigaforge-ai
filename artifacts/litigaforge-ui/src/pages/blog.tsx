import { useEffect } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function Blog() {
  useEffect(() => {
    window.location.href = "https://litigaforge-blog.arif-806.workers.dev/blog/";
  }, []);

  return (
    <>
      <SEOHelmet
        title="Legal Guides & Resources | LitigaForge AI"
        description="AI-powered legal insights for India, UAE, UK, USA and more."
        canonical="/blog"
      />
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting to LitigaForge AI Legal Blog...</p>
      </div>
    </>
  );
}
