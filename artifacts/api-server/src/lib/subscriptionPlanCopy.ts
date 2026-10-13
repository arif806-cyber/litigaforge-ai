import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const candidatePaths = [
  resolve(process.cwd(), "shared-plan-prices.json"),
  resolve(process.cwd(), "../../shared-plan-prices.json"),
];
const sharedPricesPath = candidatePaths.find(existsSync);
if (!sharedPricesPath) {
  throw new Error("shared-plan-prices.json was not found from the API server working directory");
}
const sharedPrices = JSON.parse(
  readFileSync(sharedPricesPath, "utf8"),
) as {
  advocate: {
    free: { name: string; monthly: number };
    professional: { name: string; monthly: number };
    advocate_pro: { name: string; monthly: number };
  };
};

export const subscriptionPlanCopy = {
  freeName: sharedPrices.advocate.free.name,
  advocateProName: sharedPrices.advocate.professional.name,
  advocateProMonthly: sharedPrices.advocate.professional.monthly,
  advocateProMonthlyDisplay: sharedPrices.advocate.professional.monthly.toLocaleString("en-IN"),
  chamberName: sharedPrices.advocate.advocate_pro.name,
  chamberMonthly: sharedPrices.advocate.advocate_pro.monthly,
  chamberMonthlyDisplay: sharedPrices.advocate.advocate_pro.monthly.toLocaleString("en-IN"),
};
