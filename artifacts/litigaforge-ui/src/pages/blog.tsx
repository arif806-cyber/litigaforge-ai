import { useEffect } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function Blog() {
  useEffect(() => {
    window.location.href = "/blog";
  }, []);

  return (
    <>
      <SEOHelmet
        title="India Legal Guides & Resources | LitigaForge"
        description="Legal information and case-law insights for advocates and clients in Telangana and Andhra Pradesh."
        canonical="/blog"
      />
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting to LitigaForge legal guides...</p>
      </div>
    </>
  );
}
