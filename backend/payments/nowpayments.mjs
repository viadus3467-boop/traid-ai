import { createHmac, timingSafeEqual } from "node:crypto";

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";

function getBaseUrl(origin) {
  return String(process.env.TRADE_AI_PUBLIC_URL || origin || "http://127.0.0.1:4173").replace(/\/$/, "");
}

export function isNowPaymentsConfigured() {
  return Boolean(process.env.NOWPAYMENTS_API_KEY);
}

export function getNowPaymentsConfig(origin) {
  return {
    available: isNowPaymentsConfigured(),
    provider: "nowpayments",
    baseUrl: getBaseUrl(origin),
  };
}

export async function createNowPaymentsInvoice({ user, origin }) {
  if (!isNowPaymentsConfigured()) {
    throw new Error("NOWPayments is not configured. Set NOWPAYMENTS_API_KEY first.");
  }

  const baseUrl = getBaseUrl(origin);
  const orderId = `trade-ai-plus-${user.id}-${Date.now()}`;

  const response = await fetch(`${NOWPAYMENTS_API}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.NOWPAYMENTS_API_KEY,
    },
    body: JSON.stringify({
      price_amount: 20,
      price_currency: "usd",
      pay_currency: process.env.NOWPAYMENTS_PAY_CURRENCY || "usdttrc20",
      ipn_callback_url: `${baseUrl}/api/webhooks/nowpayments`,
      order_id: orderId,
      order_description: "Trade Ai PLUS monthly access",
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
      is_fixed_rate: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || `NOWPayments request failed with ${response.status}`);
  }

  return {
    id: payload.payment_id || orderId,
    provider: "nowpayments",
    orderId,
    payAddress: payload.pay_address || null,
    payAmount: payload.pay_amount || null,
    payCurrency: payload.pay_currency || process.env.NOWPAYMENTS_PAY_CURRENCY || "usdttrc20",
    paymentStatus: payload.payment_status || "waiting",
    expiresAt: payload.valid_until || null,
  };
}

export function verifyNowPaymentsSignature(rawBody, signatureHeader) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected.toLowerCase()), Buffer.from(String(signatureHeader).toLowerCase()));
  } catch {
    return false;
  }
}
