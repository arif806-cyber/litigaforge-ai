import { useParams, Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { getArticle } from "@/data/articles";
import { Clock, ArrowLeft, ArrowRight, Tag, AlertTriangle, BookOpen } from "lucide-react";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getArticle(slug) : undefined;

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <BookOpen className="w-12 h-12 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold text-foreground">Article Not Found</h1>
        <p className="text-muted-foreground">This article doesn't exist or has been moved.</p>
        <Link href="/blog">
          <button className="flex items-center gap-2 text-primary font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Legal Guides
          </button>
        </Link>
      </div>
    );
  }

  const siteUrl = "https://litiga-forge-ai.replit.app";

  return (
    <>
      <SEOHelmet
        title={`${article.title} – LitigaForge AI`}
        description={article.description}
        canonical={`/blog/${article.slug}`}
        keywords={article.keywords.join(", ")}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": article.title,
          "description": article.description,
          "url": `${siteUrl}/blog/${article.slug}`,
          "datePublished": article.publishedDate,
          "dateModified": article.publishedDate,
          "author": {
            "@type": "Organization",
            "name": "LitigaForge AI",
            "url": siteUrl,
          },
          "publisher": {
            "@type": "Organization",
            "name": "LitigaForge AI",
            "url": siteUrl,
          },
          "keywords": article.keywords.join(", "),
          "inLanguage": "en-IN",
          "about": {
            "@type": "Thing",
            "name": "Indian Law",
          },
        }}
      />

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Link href="/blog">
              <span className="hover:text-primary cursor-pointer transition-colors">Legal Guides</span>
            </Link>
            <span>/</span>
            <span className="text-foreground truncate max-w-[200px] sm:max-w-none">{article.title}</span>
          </nav>

          {/* Header */}
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Tag className="w-3 h-3" />
                {article.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {article.readTime} min read
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(article.publishedDate).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-4">
              {article.title}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {article.description}
            </p>
          </header>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Disclaimer:</span> This article is for general informational purposes only and does not constitute legal advice. Laws may change. Please consult a qualified advocate for advice specific to your situation.
            </p>
          </div>

          {/* Article body */}
          <article className="prose-custom space-y-8">
            {article.sections.map((section, si) => (
              <section key={si}>
                {section.heading && (
                  <h2 className="text-xl font-bold text-foreground mb-3 mt-6 first:mt-0">
                    {section.heading}
                  </h2>
                )}
                {section.blocks.map((block, bi) =>
                  block.type === "paragraph" ? (
                    <p key={bi} className="text-foreground/85 leading-relaxed mb-3 text-[15px]">
                      {block.text}
                    </p>
                  ) : (
                    <ul key={bi} className="space-y-2 my-3">
                      {block.items.map((item, li) => (
                        <li key={li} className="flex items-start gap-2.5 text-[15px] text-foreground/85">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </section>
            ))}
          </article>

          {/* Keywords */}
          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-widest">Related Topics</p>
            <div className="flex flex-wrap gap-2">
              {article.keywords.map(kw => (
                <span key={kw} className="px-2.5 py-1 bg-muted rounded-lg text-xs text-muted-foreground border border-border">
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 rounded-2xl p-6">
            <h3 className="font-bold text-foreground mb-2">Need Legal Help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Post your case on LitigaForge AI and get matched with verified advocates in Telangana &amp; Andhra Pradesh. Free to post, no commitment.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/post-case">
                <button className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Find a Lawyer <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link href="/ask">
                <button className="flex items-center gap-2 border border-border bg-background px-5 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                  Ask AI a Question
                </button>
              </Link>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8">
            <Link href="/blog">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                <ArrowLeft className="w-4 h-4" /> Back to Legal Guides
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
