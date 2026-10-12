import sharedPlanPrices from "../../../../shared-plan-prices.json";

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
    free: { price: sharedPlanPrices.public.IN.free, features: ["3 AI questions", "View templates", "NALSA checker"] },
    basic: {
      price: sharedPlanPrices.public.IN.basic,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "Case tracking"],
    },
    pro: {
      price: sharedPlanPrices.public.IN.pro,
      period: "month",
      features: [
        "Unlimited AI",
        "Unlimited documents",
        "Priority lawyer matching",
        "Court date reminders",
        "Document analyzer",
      ],
    },
    per_doc: { price: sharedPlanPrices.public.IN.per_doc },
  },
  US: {
    currency: "$",
    free: { price: sharedPlanPrices.public.US.free, features: ["3 AI questions", "Rights checker", "Resource finder"] },
    basic: {
      price: sharedPlanPrices.public.US.basic,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "State law lookup", "Email support"],
    },
    pro: {
      price: sharedPlanPrices.public.US.pro,
      period: "month",
      features: ["Unlimited everything", "Spanish support", "Attorney review add-on", "Priority matching"],
    },
    per_doc: { price: sharedPlanPrices.public.US.per_doc },
  },
  GB: {
    currency: "£",
    free: { price: sharedPlanPrices.public.GB.free, features: ["3 AI questions", "Rights checker", "Court fee calculator"] },
    basic: {
      price: sharedPlanPrices.public.GB.basic,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "Tribunal guide"],
    },
    pro: {
      price: sharedPlanPrices.public.GB.pro,
      period: "month",
      features: ["Unlimited everything", "Solicitor matching", "Document review"],
    },
    per_doc: { price: sharedPlanPrices.public.GB.per_doc },
  },
  AE: {
    currency: "AED",
    free: { price: sharedPlanPrices.public.AE.free, features: ["3 AI questions", "Indian law basics", "Emergency cheque steps"] },
    basic: {
      price: sharedPlanPrices.public.AE.basic,
      period: "month",
      features: ["20 AI questions", "Arabic + English", "5 document drafts", "Labor law guide"],
    },
    pro: {
      price: sharedPlanPrices.public.AE.pro,
      period: "month",
      features: ["Unlimited everything", "Arabic RTL interface", "DIFC specialist routing"],
    },
    per_doc: { price: sharedPlanPrices.public.AE.per_doc },
  },
  DE: {
    currency: "€",
    free: { price: sharedPlanPrices.public.DE.free, features: ["3 KI-Fragen", "Rechtsübersicht", "Fristenrechner"] },
    basic: {
      price: sharedPlanPrices.public.DE.basic,
      period: "Monat",
      features: ["20 KI-Fragen", "5 Dokument-Entwürfe", "Mietrecht + Arbeitsrecht"],
    },
    pro: {
      price: sharedPlanPrices.public.DE.pro,
      period: "Monat",
      features: ["Unbegrenzt alles", "Anwalt-Matching", "DSGVO Toolkit", "Abmahnung-Notfall"],
    },
    per_doc: { price: sharedPlanPrices.public.DE.per_doc },
  },
  AU: {
    currency: "A$",
    free: { price: sharedPlanPrices.public.AU.free, features: ["3 AI questions", "Rights checker", "Fair Work guide"] },
    basic: {
      price: sharedPlanPrices.public.AU.basic,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "State law guide"],
    },
    pro: {
      price: sharedPlanPrices.public.AU.pro,
      period: "month",
      features: ["Unlimited everything", "Lawyer matching", "Document review"],
    },
    per_doc: { price: sharedPlanPrices.public.AU.per_doc },
  },
  CA: {
    currency: "CA$",
    free: { price: sharedPlanPrices.public.CA.free, features: ["3 AI questions", "Province rights checker", "Immigration guide"] },
    basic: {
      price: sharedPlanPrices.public.CA.basic,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "French + English"],
    },
    pro: {
      price: sharedPlanPrices.public.CA.pro,
      period: "month",
      features: ["Unlimited everything", "Lawyer matching", "Document review"],
    },
    per_doc: { price: sharedPlanPrices.public.CA.per_doc },
  },
  SG: {
    currency: "S$",
    free: { price: sharedPlanPrices.public.SG.free, features: ["3 AI questions", "MOM rights checker", "Basic legal guide"] },
    basic: {
      price: sharedPlanPrices.public.SG.basic,
      period: "month",
      features: ["20 AI questions", "5 document drafts", "Employment + HDB guide"],
    },
    pro: {
      price: sharedPlanPrices.public.SG.pro,
      period: "month",
      features: ["Unlimited everything", "Lawyer matching", "IP + PDPA toolkit"],
    },
    per_doc: { price: sharedPlanPrices.public.SG.per_doc },
  },
};

export default PRICING;

export function getPricing(code: string): CountryPricing {
  return PRICING[code.toUpperCase()] || PRICING.IN;
}
