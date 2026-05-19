import Stripe from "stripe";

// Lazily-initialized Stripe client — server-side only (secret key).
// Never import this in client components.
//
// Init is deferred to first access so that `next build` page-data collection
// can import API route modules in preview environments (where the env var
// isn't set) without throwing. The error only fires if code actually calls
// into Stripe at runtime.

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  return _stripe;
}

const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const real = getStripe() as unknown as Record<string | symbol, unknown>;
    const value = real[prop as string];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export default stripe;
