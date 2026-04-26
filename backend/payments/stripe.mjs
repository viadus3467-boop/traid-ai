import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

function formEncode(payload) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.append(key, String(value));
  }
  return params;
}

function getBaseUrl(origin) {
  return String(process.env.TRADE_AI_PUBLIC_URL || origin || "http://127.0.0.1:4173").replace(/\/$/, "");
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripePaymentConfig(origin) {
  return {
    available: isStripeConfigured(),
    provider: "stripe",
    baseUrl: getBaseUrl(origin),
  };
}

export async function createStripeCheckoutSession({ user, origin }) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY first.");
  }

  const baseUrl = getBaseUrl(origin);
  const params = formEncode({
    mode: "subscription",
    success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?checkout=cancel`,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "Trade Ai PLUS",
    "line_items[0][price_data][product_data][description]": "Premium AI trading signals subscription",
    "line_items[0][price_data][unit_amount]": 2000,
    "line_items[0][price_data][recurring][interval]": "month",
    "subscription_data[trial_period_days]": 7,
    "line_items[0][quantity]": 1,
    customer_email: user.email,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    payment_method_collection: "always",
    "metadata[userId]": user.id,
    "metadata[plan]": "plus",
  });

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(20_000),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe checkout failed with ${response.status}`);
  }

  return {
    id: payload.id,
    url: payload.url,
    provider: "stripe",
    mode: "subscription",
  };
}

export async function confirmStripeCheckoutSession(sessionId) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY first.");
  }

  const response = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    },
    signal: AbortSignal.timeout(20_000),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe session lookup failed with ${response.status}`);
  }

  return {
    id: payload.id,
    status: payload.status,
    paymentStatus: payload.payment_status,
    clientReferenceId: payload.client_reference_id || null,
    metadata: payload.metadata || {},
  };
}

export function verifyStripeWebhook(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const segments = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );

  if (!segments.t || !segments.v1) {
    return false;
  }

  const signedPayload = `${segments.t}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(segments.v1));
  } catch {
    return false;
  }
}
