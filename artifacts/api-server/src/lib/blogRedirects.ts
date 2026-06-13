// Canonical 301 redirect map for retired / deduplicated blog article slugs.
//
// key   = old slug (the path segment after /blog/)
// value = new slug to redirect to; an empty string "" redirects to the /blog index.
//
// These are served as a REAL 301 by the Express api-server (see app.ts), registered
// BEFORE the blog reverse-proxy. The proxy fetches the Worker with redirect:"follow",
// so a Worker-side _redirects rule would be flattened into a 200 at the old apex URL;
// handling the redirect here keeps litigaforge.com/blog/<old> a proper 301 for SEO.
export const BLOG_REDIRECTS: Record<string, string> = {
  "germany-labour-law-claim-compensation-for-overtime": "germany-labour-law-claim-compensation-overtime",
  "germany-labour-law-overtime-compensation": "germany-labour-law-claim-compensation-overtime",
  "india-tenant-rights-security-deposit-refund": "tenant-rights-in-india",
  "divorce-and-alimony-rights-for-women-in-india": "india-divorce-laws-and-alimony-rights",
  "india-divorce-laws-and-alimony": "india-divorce-laws-and-alimony-rights",
  "understanding-divorce-and-alimony-laws-in-india-what-women-n": "india-divorce-laws-and-alimony-rights",
  "how-to-send-a-legal-notice-to-your-employer-for-wrongful-ter": "how-to-send-legal-notice-for-wrongful-termination-in-india",
  "wrongful-termination-in-india": "how-to-send-legal-notice-for-wrongful-termination-in-india",
  "understanding-australias-workplace-bullying-laws-and-how-to-": "australia-workplace-bullying-laws-2026",
  "consumer-complaint-refund-india-2026": "consumer-complaint-defective-product-refund-india",
  "startup-founder-legal-guide-protect-ip-india": "startup-founder-legal-guide-protect-ip-in-india",
  "uae-end-of-service-gratuity-calculation": "uae-labour-law-end-of-service-gratuity-calculation",
  "uae-labour-law-end-of-service-gratuity": "uae-labour-law-end-of-service-gratuity-calculation",
  "unfair-dismissal-claims-uk": "uk-unfair-dismissal-claim-compensation",
  "welcome": "",
};
