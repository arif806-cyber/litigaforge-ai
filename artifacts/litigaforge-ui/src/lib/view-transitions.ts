import { flushSync } from "react-dom";
import type { AroundNavHandler } from "wouter";

/**
 * Progressive cross-page View Transitions for wouter.
 *
 * Passed to <Router aroundNav={...}>. wouter invokes this for every navigation
 * that goes through its `navigate` (useLocation/setLocation, <Link>, <Redirect>)
 * AFTER the router base has been applied. CountryGate rewrites the URL with a
 * direct history.replaceState() which never goes through wouter — so those
 * country swaps are automatically excluded and never trigger a transition.
 *
 * Falls back to a plain navigate when:
 *   - the View Transitions API is unavailable,
 *   - the user prefers reduced motion,
 *   - the caller opted out via { transition: false }.
 *
 * The DOM update is wrapped in flushSync so React commits synchronously inside
 * startViewTransition's callback (required by the View Transitions API).
 */
export const viewTransitionAroundNav: AroundNavHandler = (navigate, to, options) => {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    prefersReducedMotion ||
    options?.transition === false
  ) {
    navigate(to, options);
    return;
  }

  document.startViewTransition(() => {
    flushSync(() => {
      navigate(to, options);
    });
  });
};
