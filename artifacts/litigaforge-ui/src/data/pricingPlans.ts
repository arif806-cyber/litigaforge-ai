export interface PricingTier {
  price: number;
  period?: string;
  features: string[];
}

export interface PerDoc {
  price: number;
}

export interface CountryPricing {
  currency: string;
  free: PricingTier;
  basic: PricingTier;
  pro: PricingTier;
  per_doc: PerDoc;
}

const PRICING: Record<string, CountryPricing> = {
  IN: {
    currency: "₹",
    free: { price: 0, features: ["3 AI questions", "View templates", "NALSA checker"] },
    basic: {
      price: 499,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "Case tracking", "WhatsApp alerts"],
    },
    pro: {
      price: 1499,
      period: "month",
      features: [
        "Unlimited AI",
        "Unlimited documents",
        "Priority lawyer matching",
        "Court date reminders",
        "Document analyzer",
      ],
    },
    per_doc: { price: 299 },
  },
  US: {
    currency: "$",
    free: { price: 0, features: ["3 AI questions", "Rights checker", "Resource finder"] },
    basic: {
      price: 9,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "State law lookup", "Email support"],
    },
    pro: {
      price: 29,
      period: "month",
      features: ["Unlimited everything", "Spanish support", "Attorney review add-on", "Priority matching"],
    },
    per_doc: { price: 19 },
  },
  GB: {
    currency: "£",
    free: { price: 0, features: ["3 AI questions", "Rights checker", "Court fee calculator"] },
    basic: {
      price: 7,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "Tribunal guide"],
    },
    pro: {
      price: 19,
      period: "month",
      features: ["Unlimited everything", "Solicitor matching", "Document review"],
    },
    per_doc: { price: 12 },
  },
  AE: {
    currency: "AED",
    free: { price: 0, features: ["3 AI questions", "UAE law basics", "Emergency cheque steps"] },
    basic: {
      price: 35,
      period: "month",
      features: ["20 AI questions", "Arabic + English", "5 document drafts", "Labor law guide"],
    },
    pro: {
      price: 99,
      period: "month",
      features: ["Unlimited everything", "Arabic RTL interface", "DIFC specialist routing", "WhatsApp support"],
    },
    per_doc: { price: 49 },
  },
  DE: {
    currency: "€",
    free: { price: 0, features: ["3 KI-Fragen", "Rechtsübersicht", "Fristenrechner"] },
    basic: {
      price: 8,
      period: "Monat",
      features: ["20 KI-Fragen", "5 Dokument-Entwürfe", "Mietrecht + Arbeitsrecht"],
    },
    pro: {
      price: 24,
      period: "Monat",
      features: ["Unbegrenzt alles", "Anwalt-Matching", "DSGVO Toolkit", "Abmahnung-Notfall"],
    },
    per_doc: { price: 15 },
  },
  AU: {
    currency: "A$",
    free: { price: 0, features: ["3 AI questions", "Rights checker", "Fair Work guide"] },
    basic: {
      price: 12,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "State law guide"],
    },
    pro: {
      price: 35,
      period: "month",
      features: ["Unlimited everything", "Lawyer matching", "Document review"],
    },
    per_doc: { price: 15 },
  },
  CA: {
    currency: "CA$",
    free: { price: 0, features: ["3 AI questions", "Province rights checker", "Immigration guide"] },
    basic: {
      price: 12,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "French + English"],
    },
    pro: {
      price: 35,
      period: "month",
      features: ["Unlimited everything", "Lawyer matching", "Document review"],
    },
    per_doc: { price: 15 },
  },
  SG: {
    currency: "S$",
    free: { price: 0, features: ["3 AI questions", "MOM rights checker", "Basic legal guide"] },
    basic: {
      price: 12,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "Employment + HDB guide"],
    },
    pro: {
      price: 35,
      period: "month",
      features: ["Unlimited everything", "Lawyer matching", "IP + PDPA toolkit"],
    },
    per_doc: { price: 15 },
  },
};

export default PRICING;

export function getPricing(code: string): CountryPricing {
  return PRICING[code.toUpperCase()] || PRICING.IN;
}
