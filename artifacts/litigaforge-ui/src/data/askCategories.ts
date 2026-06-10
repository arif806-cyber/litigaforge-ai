/**
 * Country-relevant /ask categories. Each country surfaces the legal areas that
 * actually matter in its jurisdiction (e.g. GST & Tax for India, Migration for
 * Australia, Mietrecht/Datenschutz for Germany) instead of a single India list.
 */

export interface AskCategory {
  id: string;
  label: string;
  /** German label shown when the active country is Germany. */
  label_de?: string;
}

const ASK_CATEGORIES: Record<string, AskCategory[]> = {
  IN: [
    { id: "property", label: "Property" },
    { id: "family", label: "Family" },
    { id: "criminal", label: "Criminal" },
    { id: "consumer", label: "Consumer" },
    { id: "labour", label: "Labour" },
    { id: "gst-tax", label: "GST & Tax" },
    { id: "motor-accident", label: "Motor Accident" },
    { id: "civil", label: "Civil" },
    { id: "general", label: "General" },
  ],
  US: [
    { id: "employment", label: "Employment" },
    { id: "immigration", label: "Immigration" },
    { id: "tenancy", label: "Tenant & Housing" },
    { id: "consumer", label: "Consumer" },
    { id: "family", label: "Family" },
    { id: "small-claims", label: "Small Claims" },
    { id: "contracts", label: "Contracts" },
    { id: "criminal", label: "Criminal" },
    { id: "general", label: "General" },
  ],
  GB: [
    { id: "employment", label: "Employment" },
    { id: "housing", label: "Housing" },
    { id: "immigration", label: "Immigration" },
    { id: "consumer", label: "Consumer" },
    { id: "family", label: "Family" },
    { id: "contracts", label: "Contracts" },
    { id: "criminal", label: "Criminal" },
    { id: "general", label: "General" },
  ],
  AE: [
    { id: "labour", label: "Labour" },
    { id: "tenancy", label: "Tenancy / RERA" },
    { id: "business", label: "Business" },
    { id: "visa", label: "Visa & Immigration" },
    { id: "civil", label: "Civil & Cheque" },
    { id: "family", label: "Family" },
    { id: "general", label: "General" },
  ],
  AU: [
    { id: "employment", label: "Employment" },
    { id: "family", label: "Family" },
    { id: "immigration", label: "Migration" },
    { id: "consumer", label: "Consumer" },
    { id: "tenancy", label: "Tenancy" },
    { id: "insurance", label: "Insurance" },
    { id: "general", label: "General" },
  ],
  CA: [
    { id: "immigration", label: "Immigration" },
    { id: "employment", label: "Employment" },
    { id: "tenancy", label: "Tenant Rights" },
    { id: "family", label: "Family" },
    { id: "human-rights", label: "Human Rights" },
    { id: "small-claims", label: "Small Claims" },
    { id: "criminal", label: "Criminal" },
    { id: "general", label: "General" },
  ],
  SG: [
    { id: "employment", label: "Employment" },
    { id: "tenancy", label: "Tenancy / HDB" },
    { id: "business", label: "Business" },
    { id: "ip", label: "IP" },
    { id: "data-privacy", label: "Data (PDPA)" },
    { id: "family", label: "Family" },
    { id: "general", label: "General" },
  ],
  DE: [
    { id: "employment", label: "Employment", label_de: "Arbeitsrecht" },
    { id: "tenancy", label: "Tenancy", label_de: "Mietrecht" },
    { id: "consumer", label: "Consumer", label_de: "Verbraucher" },
    { id: "family", label: "Family", label_de: "Familienrecht" },
    { id: "data-privacy", label: "Data (GDPR)", label_de: "Datenschutz" },
    { id: "contracts", label: "Contracts", label_de: "Vertragsrecht" },
    { id: "general", label: "General", label_de: "Allgemein" },
  ],
};

export function getAskCategories(code: string): AskCategory[] {
  return ASK_CATEGORIES[code.toUpperCase()] || ASK_CATEGORIES.IN;
}

export function askCategoryLabel(c: AskCategory, code: string): string {
  if (code.toUpperCase() === "DE" && c.label_de) return c.label_de;
  return c.label;
}

export function allCategoryLabel(code: string): string {
  return code.toUpperCase() === "DE" ? "Alle" : "All";
}
