import type { LucideIcon } from "lucide-react";
import {
  Gavel,
  ShoppingCart,
  Home,
  Car,
  Users,
  FileText,
  Briefcase,
  Plane,
  Scale,
  Building2,
  CreditCard,
  Shield,
  Lock,
} from "lucide-react";

export interface PainPoint {
  icon: LucideIcon;
  title: string;
  desc: string;
  link: string;
}

export interface CountryLandingContent {
  flag: string;
  painPoints: PainPoint[];
  topDocuments: string[];
}

export const COUNTRY_LANDING: Record<string, CountryLandingContent> = {
  IN: {
    flag: "🇮🇳",
    painPoints: [
      { icon: Gavel, title: "Court Case Filing", desc: "File or defend a case in Indian courts", link: "/post-case" },
      { icon: ShoppingCart, title: "Consumer Disputes", desc: "Defective products, refunds & service complaints", link: "/ask" },
      { icon: Home, title: "Property Law", desc: "Disputes, registration & inheritance issues", link: "/post-case" },
      { icon: Car, title: "Motor Accident Claims", desc: "Compensation for road accident injuries", link: "/post-case" },
      { icon: Users, title: "Family Law", desc: "Divorce, maintenance & child custody", link: "/lawyers" },
    ],
    topDocuments: ["Rental Agreement", "Legal Notice", "Affidavit", "Power of Attorney", "Will", "Consumer Complaint", "FIR Copy Request"],
  },
  US: {
    flag: "🇺🇸",
    painPoints: [
      { icon: FileText, title: "Contract Review", desc: "Understand contracts before you sign", link: "/review" },
      { icon: Briefcase, title: "Employment Law", desc: "Wrongful termination, wages & discrimination", link: "/ask" },
      { icon: Plane, title: "Immigration Help", desc: "Visas, green cards & citizenship", link: "/lawyers" },
      { icon: Scale, title: "Small Claims", desc: "Recover money owed within court limits", link: "/post-case" },
      { icon: Home, title: "Tenant Rights", desc: "Evictions, deposits & habitability", link: "/ask" },
    ],
    topDocuments: ["NDA", "Lease Agreement", "Demand Letter", "Power of Attorney", "Last Will", "LLC Operating Agreement", "Cease & Desist"],
  },
  GB: {
    flag: "🇬🇧",
    painPoints: [
      { icon: Briefcase, title: "Employment Tribunal", desc: "Unfair dismissal & workplace disputes", link: "/ask" },
      { icon: Home, title: "Housing Disputes", desc: "Deposits, repairs & evictions", link: "/ask" },
      { icon: Plane, title: "Immigration", desc: "Visas, settlement & citizenship", link: "/lawyers" },
      { icon: Users, title: "Divorce & Family", desc: "Divorce, finances & child arrangements", link: "/lawyers" },
      { icon: FileText, title: "Contract Disputes", desc: "Breach of contract & consumer rights", link: "/review" },
    ],
    topDocuments: ["Tenancy Agreement", "Section 21 Notice", "Statutory Declaration", "Will", "Power of Attorney", "Settlement Agreement"],
  },
  AE: {
    flag: "🇦🇪",
    painPoints: [
      { icon: Briefcase, title: "Labour Disputes", desc: "Unpaid wages, end-of-service & termination", link: "/ask" },
      { icon: Home, title: "Tenancy Contracts", desc: "Ejari, rent disputes & RERA cases", link: "/ask" },
      { icon: Building2, title: "Business Setup", desc: "Mainland, free zone & licensing", link: "/lawyers" },
      { icon: Plane, title: "Visa Issues", desc: "Residency, sponsorship & overstays", link: "/lawyers" },
      { icon: CreditCard, title: "Cheque Bounce Cases", desc: "Bounced cheque claims & defences", link: "/post-case" },
    ],
    topDocuments: ["Tenancy Contract", "Employment Contract", "Power of Attorney", "Legal Notice", "MOA", "NOC Letter"],
  },
  AU: {
    flag: "🇦🇺",
    painPoints: [
      { icon: Briefcase, title: "Employment Rights", desc: "Unfair dismissal & Fair Work claims", link: "/ask" },
      { icon: Users, title: "Family Law", desc: "Divorce, parenting & property", link: "/lawyers" },
      { icon: Plane, title: "Migration Help", desc: "Visas, PR & citizenship", link: "/lawyers" },
      { icon: ShoppingCart, title: "Consumer Claims", desc: "Refunds, warranties & ACL rights", link: "/ask" },
      { icon: Home, title: "Property Disputes", desc: "Tenancy, strata & conveyancing", link: "/post-case" },
    ],
    topDocuments: ["Residential Lease", "Statutory Declaration", "Will", "Power of Attorney", "Letter of Demand", "Employment Contract"],
  },
  CA: {
    flag: "🇨🇦",
    painPoints: [
      { icon: Plane, title: "Immigration & PR", desc: "Express Entry, PR & sponsorship", link: "/lawyers" },
      { icon: Briefcase, title: "Employment Law", desc: "Wrongful dismissal & severance", link: "/ask" },
      { icon: Users, title: "Family Law", desc: "Divorce, support & custody", link: "/lawyers" },
      { icon: Home, title: "Tenant Rights", desc: "Rent, repairs & evictions", link: "/ask" },
      { icon: Shield, title: "Criminal Defence", desc: "Charges, bail & record suspensions", link: "/lawyers" },
    ],
    topDocuments: ["Residential Lease", "Affidavit", "Will", "Power of Attorney", "Demand Letter", "Separation Agreement"],
  },
  SG: {
    flag: "🇸🇬",
    painPoints: [
      { icon: Briefcase, title: "Employment Disputes", desc: "Salary claims & wrongful dismissal", link: "/ask" },
      { icon: FileText, title: "Business Contracts", desc: "Draft & review commercial agreements", link: "/review" },
      { icon: Home, title: "Tenancy Issues", desc: "Rental disputes & deposits", link: "/ask" },
      { icon: Users, title: "Family Law", desc: "Divorce & maintenance under the Women's Charter", link: "/lawyers" },
      { icon: Lock, title: "IP Protection", desc: "Trademarks, copyright & patents", link: "/lawyers" },
    ],
    topDocuments: ["Tenancy Agreement", "Employment Contract", "NDA", "Will", "Lasting Power of Attorney", "Letter of Demand"],
  },
  DE: {
    flag: "🇩🇪",
    painPoints: [
      { icon: Briefcase, title: "Employment Law", desc: "Termination, wages & workplace disputes", link: "/ask" },
      { icon: Home, title: "Tenancy Rights", desc: "Mietrecht, deposits & rent increases", link: "/ask" },
      { icon: ShoppingCart, title: "Consumer Protection", desc: "Warranties, refunds & contracts", link: "/ask" },
      { icon: Users, title: "Family Law", desc: "Divorce, custody & maintenance", link: "/lawyers" },
      { icon: Lock, title: "Data Privacy (GDPR)", desc: "GDPR rights & data complaints", link: "/review" },
    ],
    topDocuments: ["Mietvertrag", "Kündigungsschreiben", "Vollmacht", "Testament", "Abmahnung", "Arbeitsvertrag"],
  },
};

export function getLandingContent(code: string): CountryLandingContent {
  return COUNTRY_LANDING[code.toUpperCase()] || COUNTRY_LANDING.IN;
}
