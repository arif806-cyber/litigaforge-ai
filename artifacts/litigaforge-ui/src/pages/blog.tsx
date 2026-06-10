import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { articles } from "@/data/articles";
import { Clock, ArrowRight, BookOpen, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { useCountry } from "@/hooks/useCountry";
import { BLOG_COPY } from "@/lib/country-copy";

const CATEGORY_COLORS: Record<string, string> = {
  "Legal Help":      "bg-blue-100 text-blue-700 border-blue-200",
  "Legal Aid":       "bg-green-100 text-green-700 border-green-200",
  "Consumer Rights": "bg-amber-100 text-amber-700 border-amber-200",
  "Property Law":    "bg-violet-100 text-violet-700 border-violet-200",
  "Court Procedures":"bg-muted text-slate-700 border-border",
};

export default function Blog() {
  const { activeCode } = useCountry();
  const copy = BLOG_COPY[activeCode.toUpperCase()] ?? BLOG_COPY.IN;
  return (
    <>
      <SEOHelmet
        title={`${copy.title} | LitigaForge AI`}
        description={copy.description}
        canonical="/blog"
        keywords={copy.keywords}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "LitigaForge AI Legal Guides",
          "description": copy.description,
          "url": "https://litiga-forge-ai.replit.app/blog",
          "blogPost": articles.map(a => ({
            "@type": "BlogPosting",
            "headline": a.title,
            "description": a.description,
            "url": `https://litiga-forge-ai.replit.app/blog/${a.slug}`,
            "datePublished": a.publishedDate,
          })),
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/5 via-background to-background border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary uppercase tracking-widest">Legal Guides</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              {copy.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              {copy.subtitle}
            </p>
          </div>
        </div>

        {/* Articles */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-5">
          {articles.map((article, i) => {
            const categoryColor = CATEGORY_COLORS[article.category] ?? "bg-muted text-muted-foreground border-border";
            return (
              <motion.article
                key={article.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="group bg-card border border-border rounded-2xl p-6 hover:shadow-md hover:border-primary/30 transition-all"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryColor}`}>
                    <Tag className="w-3 h-3" />
                    {article.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {article.readTime} min read
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(article.publishedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>

                <Link href={`/blog/${article.slug}`}>
                  <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-2 cursor-pointer">
                    {article.title}
                  </h2>
                </Link>

                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {article.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {article.keywords.slice(0, 3).map(kw => (
                      <span key={kw} className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <Link href={`/blog/${article.slug}`}>
                    <button className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                      Read article <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* CTA */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
          <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">Need a Lawyer for Your Case?</h2>
            <p className="text-muted-foreground text-sm mb-5">
              LitigaForge AI matches you with verified lawyers in your area — free to post, no commitment.
            </p>
            <Link href="/post-case">
              <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
                Find a Lawyer <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
