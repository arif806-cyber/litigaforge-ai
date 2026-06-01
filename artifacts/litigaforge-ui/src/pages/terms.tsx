import { Scale, FileText, AlertTriangle, Users, CreditCard, Shield, XCircle, Mail } from "lucide-react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";

const EFFECTIVE_DATE = "1 June 2026";
const CONTACT_EMAIL = "legal@litigaforge.ai";

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet
        title="Terms of Service"
        description="LitigaForge AI Terms of Service — the rules and conditions for using our platform to connect with verified advocates in Telangana & AP."
        canonical="/terms"
      />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Effective: {EFFECTIVE_DATE} · Last reviewed: {EFFECTIVE_DATE}</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-900">
          <strong>Please read carefully.</strong> By creating an account or using LitigaForge AI, you agree to these Terms. If you do not agree, do not use the platform.
        </div>
      </div>

      <Section icon={<Scale className="w-4 h-4" />} title="1. About LitigaForge AI">
        <p>
          LitigaForge AI ("<strong>Platform</strong>", "<strong>we</strong>", "<strong>us</strong>") is a legal-technology marketplace that connects clients
          with verified advocates registered with the Bar Councils of Telangana and Andhra Pradesh. We also provide AI-assisted legal information tools.
        </p>
        <p className="mt-2">
          <strong>We are not a law firm and do not provide legal advice.</strong> The Platform is a technology intermediary under the
          Information Technology Act 2000. The attorney-client relationship is formed directly and exclusively between the client and the
          advocate — LitigaForge AI is not a party to that relationship.
        </p>
      </Section>

      <Section icon={<Users className="w-4 h-4" />} title="2. Eligibility & Account">
        <ul className="space-y-2 text-sm list-disc list-inside">
          <li>You must be at least <strong>18 years old</strong> to use this Platform.</li>
          <li>You must provide accurate, complete, and up-to-date information when registering.</li>
          <li>You are responsible for maintaining the confidentiality of your password. Use a strong, unique password.</li>
          <li>You may not share your account with others or create multiple accounts.</li>
          <li>Advocates must hold a valid Bar Council enrolment. We verify Bar Council numbers before activating advocate profiles.</li>
          <li>We reserve the right to suspend or terminate accounts that violate these Terms or applicable law.</li>
        </ul>
      </Section>

      <Section icon={<AlertTriangle className="w-4 h-4" />} title="3. No Legal Advice — Important Disclaimer">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 mt-2">
          <p><strong>AI outputs are not legal advice.</strong> The AI-generated content on this Platform (case strategies, document analysis, legal Q&A, judgment summaries) is for informational and educational purposes only. It is not a substitute for professional legal advice from a qualified advocate.</p>
          <p className="mt-2">Always consult a licensed advocate before making any legal decision. LitigaForge AI, its directors, employees, and AI providers accept no liability for reliance on AI-generated content.</p>
        </div>
      </Section>

      <Section icon={<FileText className="w-4 h-4" />} title="4. User Conduct">
        <p className="mb-2">You agree <strong>not</strong> to use the Platform to:</p>
        <ul className="space-y-1.5 text-sm list-disc list-inside">
          <li>Post false, misleading, or fraudulent case information</li>
          <li>Impersonate any advocate, court officer, or other person</li>
          <li>Upload malware, viruses, or malicious files</li>
          <li>Attempt to access another user's data, documents, or account</li>
          <li>Reverse-engineer, scrape, or extract data from the Platform at scale</li>
          <li>Harass, threaten, or abuse other users or advocates</li>
          <li>Violate any applicable Indian law, including the IT Act 2000, IPC, or Bar Council rules</li>
          <li>Use the Platform for money laundering, fraud, or any criminal purpose</li>
        </ul>
        <p className="mt-2 text-sm">Violations may result in immediate account suspension, content removal, and reporting to law enforcement.</p>
      </Section>

      <Section icon={<Shield className="w-4 h-4" />} title="5. Advocate Responsibilities">
        <ul className="space-y-1.5 text-sm list-disc list-inside">
          <li>Advocates must maintain a valid Bar Council enrolment at all times.</li>
          <li>Advocates must comply with the Bar Council of India Rules on professional conduct, including rules on advertising and fee transparency.</li>
          <li>Advocates are solely responsible for the legal advice and services they provide to clients.</li>
          <li>LitigaForge AI is not liable for the quality, outcome, or any aspect of the legal services provided by advocates on this Platform.</li>
          <li>Advocates must keep client information confidential in accordance with professional ethics rules.</li>
        </ul>
      </Section>

      <Section icon={<CreditCard className="w-4 h-4" />} title="6. Subscriptions & Payments">
        <ul className="space-y-1.5 text-sm list-disc list-inside">
          <li>The Platform offers Free, Professional (₹999/month), and Advocate Pro (₹2,499/month) plans.</li>
          <li>Payments are processed by Razorpay (RBI-licensed). Your card/UPI details are never stored by us.</li>
          <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
          <li>Refunds: we offer a 7-day refund for new subscriptions if no AI or matching features were used. Contact <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a> within 7 days of payment.</li>
          <li>We reserve the right to change plan pricing with 30 days' notice.</li>
        </ul>
      </Section>

      <Section icon={<FileText className="w-4 h-4" />} title="7. Intellectual Property">
        <ul className="space-y-1.5 text-sm list-disc list-inside">
          <li>All Platform code, design, AI models, and branding are owned by LitigaForge AI and protected by copyright.</li>
          <li>You retain ownership of the content you upload (case documents, descriptions). By uploading, you grant us a limited licence to process and store it solely to provide the service.</li>
          <li>AI-generated outputs (strategies, summaries, document drafts) are provided to you for personal/professional use. You may not resell or redistribute them as standalone products.</li>
          <li>You may not use the LitigaForge name, logo, or branding without written permission.</li>
        </ul>
      </Section>

      <Section icon={<XCircle className="w-4 h-4" />} title="8. Limitation of Liability">
        <p className="text-sm">
          To the maximum extent permitted by Indian law, LitigaForge AI shall not be liable for:
        </p>
        <ul className="space-y-1.5 text-sm list-disc list-inside mt-2">
          <li>Any outcome of legal proceedings, whether or not an advocate was found via this Platform</li>
          <li>Inaccuracies in AI-generated legal information</li>
          <li>Any indirect, incidental, or consequential damages arising from use of the Platform</li>
          <li>Loss of data due to events beyond our reasonable control</li>
          <li>The conduct of advocates after they have been matched with clients</li>
        </ul>
        <p className="mt-2 text-sm">
          Our total liability to you for any direct damages shall not exceed the subscription fees you paid in the 3 months immediately preceding the claim.
        </p>
      </Section>

      <Section icon={<Scale className="w-4 h-4" />} title="9. Governing Law & Disputes">
        <ul className="space-y-1.5 text-sm list-disc list-inside">
          <li>These Terms are governed by the laws of the Republic of India.</li>
          <li>Any disputes shall be subject to the exclusive jurisdiction of the courts at Hyderabad, Telangana.</li>
          <li>We encourage resolution of disputes through our grievance process before litigation. Contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>.</li>
        </ul>
      </Section>

      <Section icon={<FileText className="w-4 h-4" />} title="10. Changes to These Terms">
        <p className="text-sm">
          We may update these Terms from time to time. We will notify registered users by email and display a notice on the Platform at least <strong>14 days</strong> before changes take effect. Continued use after the effective date constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section icon={<Mail className="w-4 h-4" />} title="11. Contact">
        <div className="bg-muted/40 rounded-xl p-4 text-sm space-y-1 border border-border">
          <p><strong>Legal / Grievance Officer</strong></p>
          <p>LitigaForge AI</p>
          <p>Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a></p>
          <p>Response time: within 72 hours</p>
        </div>
      </Section>

      <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>LitigaForge AI · Terms of Service · Effective {EFFECTIVE_DATE}</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy"><span className="text-primary hover:underline cursor-pointer">Privacy Policy</span></Link>
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
