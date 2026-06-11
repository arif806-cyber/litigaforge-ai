import { useEffect } from "react";
import { useParams } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug) {
      window.location.href = `https://litigaforge-blog.arif-806.workers.dev/blog/${slug}`;
    } else {
      window.location.href = "https://litigaforge-blog.arif-806.workers.dev/blog/";
    }
  }, [slug]);

  return (
    <>
      <SEOHelmet
        title="Legal Guides & Resources | LitigaForge AI"
        description="AI-powered legal insights for India, UAE, UK, USA and more."
        canonical={slug ? `/blog/${slug}` : "/blog"}
      />
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting to article...</p>
      </div>
    </>
  );
}
