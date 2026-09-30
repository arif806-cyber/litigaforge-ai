import { useEffect } from "react";
import { useParams } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { truncateTitle } from "@/lib/title";

const REVIEWER_NAME = import.meta.env.VITE_ARTICLE_REVIEWER_NAME?.trim();
const REVIEWER_ENROLMENT = import.meta.env.VITE_ARTICLE_REVIEWER_ENROLMENT?.trim();

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
        title={truncateTitle("India Legal Article | LitigaForge")}
        description="Legal information and case-law insights for advocates and clients in Telangana and Andhra Pradesh."
        canonical={slug ? `/blog/${slug}` : "/blog"}
        noIndex={Boolean(
          slug &&
          /^(?:\/us|\/gb|\/ae|\/au|\/ca|\/sg|\/de)\/blog\//i.test(window.location.pathname) ||
          (!/^(?:\/in\/)?blog\//i.test(window.location.pathname) &&
            !/(?:india|indian|telangana|andhra|hyderabad|nalsa|tslsa)/i.test(slug)),
        )}
      />
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting to article...</p>
        {REVIEWER_NAME && REVIEWER_ENROLMENT && (
          <p className="sr-only">Reviewed by {REVIEWER_NAME} ({REVIEWER_ENROLMENT})</p>
        )}
      </div>
    </>
  );
}
