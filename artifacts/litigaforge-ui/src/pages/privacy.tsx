import { Shield, Lock, Eye, Trash2, Download, Bell, Mail, Scale } from "lucide-react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";

const EFFECTIVE_DATE = "1 June 2026";
const CONTACT_EMAIL = "privacy@litigaforge.ai";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet
        title="Privacy Policy"
        description="LitigaForge AI Privacy Policy — how we collect, use and protect your personal data under the Digital Personal Data Protection Act 2023."
        canonical="/privacy"
      />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Effective: {EFFECTIVE_DATE} · Last reviewed: {EFFECTIVE_DATE}</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
          <strong>Compliance notice:</strong> This policy is drafted in accordance with the{" "}
          <strong>Digital Personal Data Protection Act 2023 (DPDP Act)</strong> of India, the{" "}
          <strong>Information Technology Act 2000</strong>, and the{" "}
          <strong>IT (Reasonable Security Practices) Rules 2011</strong>.
        </div>
      </div>

      <Section icon={<Scale className="w-4 h-4" />} title="1. Who We Are">
        <p>
          LitigaForge AI ("<strong>we</strong>", "<strong>our</strong>", "<strong>the Platform</strong>") is a legal-technology platform
          connecting clients with verified advocates in Telangana and Andhra Pradesh. We are the <strong>Data Fiduciary</strong>
          under the DPDP Act 2023 for all personal data processed on this platform.
        </p>
        <p className="mt-2">
          <strong>Contact for data matters:</strong>{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>
        </p>
      </Section>

      <Section icon={<Eye className="w-4 h-4" />} title="2. What Data We Collect">
        <Table rows={[
          ["Full name", "Account registration", "Account lifetime"],
          ["Email address", "Authentication, notifications", "Account lifetime"],
          ["Phone number (optional)", "Advocate contact matching", "Account lifetime"],
          ["Password (bcrypt hashed)", "Authentication only — never stored in plain text", "Account lifetime"],
          ["Case descriptions", "AI matching, legal strategy generation", "Account lifetime"],
          ["Uploaded documents (PDF/DOC/IMG)", "Case management, AI analysis", "Account lifetime or until deleted"],
          ["Chat messages with advocates", "Case collaboration", "Account lifetime"],
          ["Legal questions asked", "Community Q&A, AI answers", "Account lifetime"],
          ["Bar Council number (advocates)", "Verification only", "Account lifetime"],
          ["Payment reference (Razorpay)", "Subscription records", "7 years (statutory)"],
          ["Device/IP address (rate limiting)", "Abuse prevention only", "30 days rolling"],
        ]} headers={["Data", "Purpose", "Retention"]} />
        <p className="mt-3 text-sm text-muted-foreground">
          We do <strong>not</strong> collect Aadhaar numbers, PAN details, biometric data, or financial account credentials.
        </p>
      </Section>

      <Section icon={<Lock className="w-4 h-4" />} title="3. How We Protect Your Data">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Passwords", detail: "bcrypt-hashed with random salt — never stored or logged in plain text" },
            { label: "Tokens", detail: "15-minute JWT access tokens + 7-day httpOnly cookie refresh tokens" },
            { label: "SQL injection", detail: "100% parameterized queries via asyncpg — user input never concatenated into SQL" },
            { label: "File uploads", detail: "Allowlisted extensions (PDF/DOC/DOCX/JPG/PNG/TXT) + 25 MB limit + MIME validation" },
            { label: "Document access", detail: "All uploaded files served through authenticated endpoints — no public URLs" },
            { label: "Transport security", detail: "TLS 1.2+ enforced in production; HSTS enabled with 2-year max-age" },
            { label: "Security headers", detail: "X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy" },
            { label: "Rate limiting", detail: "Login: 5/min · Registration: 3/min · File upload: 30/min · Account deletion: 3/min" },
            { label: "Input sanitisation", detail: "All user-supplied text sanitised before AI processing and database storage" },
            { label: "Error scrubbing", detail: "Passwords, tokens, Aadhaar, PAN redacted from all error-monitoring payloads" },
            { label: "CORS policy", detail: "API only accepts requests from the authorised LitigaForge domain — not any website" },
            { label: "Admin access", detail: "Superuser flag enforced server-side on every admin endpoint" },
          ].map(({ label, detail }) => (
            <div key={label} className="bg-muted/40 rounded-lg px-3 py-2.5 border border-border">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<Bell className="w-4 h-4" />} title="4. Legal Basis for Processing">
        <p>Under the DPDP Act 2023, we process personal data on the following lawful bases:</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li><strong>Consent (§ 6):</strong> Obtained explicitly at registration for account creation and marketing communications. You may withdraw at any time.</li>
          <li><strong>Contract performance (§ 7(b)):</strong> Processing necessary to deliver the matching, document, and legal AI services you have subscribed to.</li>
          <li><strong>Legal obligation (§ 7(c)):</strong> Retention of payment records as required under the IT Act 2000 and GST legislation.</li>
          <li><strong>Legitimate interests (§ 7(d)):</strong> IP-based rate limiting and abuse prevention for platform security.</li>
        </ul>
      </Section>

      <Section icon={<Download className="w-4 h-4" />} title="5. Your Rights Under DPDP Act 2023">
        <Table rows={[
          ["Right to access (§ 11)", "Request a copy of all personal data we hold about you", `Email ${CONTACT_EMAIL}`],
          ["Right to correction (§ 12(a))", "Correct inaccurate or incomplete personal data", "Edit in your account settings"],
          ["Right to erasure (§ 12(1)(b))", "Permanently delete your account and all personal data", "Settings → Delete Account, or email us"],
          ["Right to grievance redressal (§ 13)", "Raise a complaint about how we process your data", `Email ${CONTACT_EMAIL} — 72-hour response`],
          ["Right to nominate (§ 14)", "Nominate a person to exercise rights on your behalf", `Email ${CONTACT_EMAIL}`],
          ["Withdraw consent", "Withdraw consent for processing at any time", "Account Settings → Privacy"],
        ]} headers={["Right", "What it means", "How to exercise"]} />
        <p className="mt-3 text-sm text-muted-foreground">
          We respond to all verified data-rights requests within <strong>72 hours</strong>. Account deletion requests are processed immediately and irreversibly.
        </p>
      </Section>

      <Section icon={<Trash2 className="w-4 h-4" />} title="6. Data Deletion — What Happens">
        <p className="text-sm">When you delete your account, the following is <strong>permanently and irreversibly</strong> removed:</p>
        <ul className="mt-2 space-y-1 text-sm list-disc list-inside text-muted-foreground">
          <li>Your name, email address, and password hash</li>
          <li>All case descriptions and requirements you posted</li>
          <li>All uploaded documents (also deleted from disk storage)</li>
          <li>All chat messages and threads</li>
          <li>All legal questions you asked</li>
          <li>All match and proposal records</li>
          <li>All active login sessions and refresh tokens</li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>Retained after deletion:</strong> Anonymised payment records required under tax law (7 years, no personal identifiers).
        </p>
      </Section>

      <Section icon={<Mail className="w-4 h-4" />} title="7. Data Sharing — We Do Not Sell Your Data">
        <p className="text-sm">
          We <strong>never sell, rent, or trade</strong> personal data to third parties. Data is shared only:
        </p>
        <ul className="mt-2 space-y-1 text-sm list-disc list-inside text-muted-foreground">
          <li><strong>With matched advocates</strong> — only your case description and contact preference, and only when you explicitly accept a match</li>
          <li><strong>Replit Inc.</strong> — infrastructure and database hosting (servers in USA; adequacy safeguards applied)</li>
          <li><strong>Razorpay</strong> — payment processing (PCI-DSS compliant; only payment reference is stored by us)</li>
          <li><strong>AI providers (Anthropic/Google/OpenAI)</strong> — legal text snippets sent for AI analysis; no PII is sent</li>
          <li><strong>Law enforcement</strong> — only when legally compelled by a court order</li>
        </ul>
      </Section>

      <Section icon={<Shield className="w-4 h-4" />} title="8. Children's Data">
        <p className="text-sm">
          LitigaForge AI is not intended for persons under the age of 18. We do not knowingly collect personal data from minors.
          If you believe a minor has registered, please contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>{" "}
          and we will delete the account immediately.
        </p>
      </Section>

      <Section icon={<Bell className="w-4 h-4" />} title="9. Breach Notification">
        <p className="text-sm">
          In the event of a personal data breach that is likely to result in harm, we will notify the{" "}
          <strong>Data Protection Board of India</strong> within <strong>72 hours</strong> of becoming aware,
          and affected users as soon as practicable, in accordance with DPDP Act 2023, § 8(6).
        </p>
      </Section>

      <Section icon={<Mail className="w-4 h-4" />} title="10. Contact & Grievance Officer">
        <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-1 border border-border">
          <p><strong>Data Protection Officer / Grievance Officer</strong></p>
          <p>LitigaForge AI</p>
          <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a></p>
          <p>Response time: within 72 hours</p>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          If you are not satisfied with our response, you may raise a complaint with the{" "}
          <strong>Data Protection Board of India</strong> once it is constituted under the DPDP Act 2023.
        </p>
      </Section>

      <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>LitigaForge AI · Privacy Policy · Effective {EFFECTIVE_DATE}</span>
        <div className="flex items-center gap-4">
          <Link href="/terms"><span className="text-primary hover:underline cursor-pointer">Terms of Service</span></Link>
          <Link href="/legal-aid"><span className="text-primary hover:underline cursor-pointer">Legal Aid</span></Link>
          <Link href="/"><span className="text-primary hover:underline cursor-pointer">Home</span></Link>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed pl-6">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-foreground">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-muted-foreground border-t border-border">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
