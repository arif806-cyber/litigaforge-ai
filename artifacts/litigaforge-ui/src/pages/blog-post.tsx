import { useEffect } from "react";
import { useParams } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug) {
      window.location.href = `/blog/${slug}`;
    } else {
      window.location.href = "/blog";
    }
  }, [slug]);

  return (
    <>
      <SEOHelmet
        title="India Legal Article | LitigaForge"
        description="Legal information and case-law insights for advocates and clients in Telangana and Andhra Pradesh."
        canonical={slug ? `/blog/${slug}` : "/blog"}
      />
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting to article...</p>
      </div>
    </>
  );
}
