import Stripe from "stripe";

// Singleton Stripe client — server-side only (secret key).
// Never import this in client components.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export default stripe;
