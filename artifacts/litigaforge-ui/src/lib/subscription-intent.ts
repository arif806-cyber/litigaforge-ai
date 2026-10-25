export type PaidAdvocatePlan = "professional" | "advocate_pro";
export type SubscriptionBilling = "monthly" | "annual";

export interface SubscriptionIntent {
  plan: PaidAdvocatePlan | null;
  billing: SubscriptionBilling;
}

/**
 * Read only the two advocate plans accepted by the subscription backend.
 * Unknown or consumer plan ids are discarded rather than being passed to checkout.
 */
export function readSubscriptionIntent(search: string): SubscriptionIntent {
  const params = new URLSearchParams(search);
  const requestedPlan = params.get("plan");
  return {
    plan: requestedPlan === "professional" || requestedPlan === "advocate_pro"
      ? requestedPlan
      : null,
    billing: params.get("billing") === "annual" ? "annual" : "monthly",
  };
}

/**
 * Serialize a validated advocate plan selection for the post-auth handoff.
 * Keeping parsing and serialization together prevents registration and checkout
 * from accepting different plan catalogs or billing values.
 */
export function subscriptionIntentPath(search: string): string | null {
  const { plan, billing } = readSubscriptionIntent(search);
  if (!plan) return null;
  return `/subscription?${new URLSearchParams({ plan, billing }).toString()}`;
}
