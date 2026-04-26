import { randomUUID } from "node:crypto";
import { updateUserPlan } from "../auth.mjs";
import { readDb, updateDb } from "../store.mjs";
import { createNowPaymentsInvoice, getNowPaymentsConfig, verifyNowPaymentsSignature } from "./nowpayments.mjs";
import { confirmStripeCheckoutSession, createStripeCheckoutSession, getStripePaymentConfig, verifyStripeWebhook } from "./stripe.mjs";

function nowIso() {
  return new Date().toISOString();
}

async function persistPaymentRecord(record) {
  await updateDb((db) => {
    db.payments.push(record);
    return db;
  });
}

export function getPaymentProviders(origin) {
  return {
    stripe: getStripePaymentConfig(origin),
    nowpayments: getNowPaymentsConfig(origin),
  };
}

export async function createPaymentSession({ provider, user, origin }) {
  if (provider === "stripe") {
    const session = await createStripeCheckoutSession({ user, origin });
    await persistPaymentRecord({
      id: randomUUID(),
      provider: "stripe",
      providerReference: session.id,
      userId: user.id,
      status: "pending",
      kind: "subscription",
      createdAt: nowIso(),
      checkoutUrl: session.url,
    });
    return session;
  }

  if (provider === "crypto") {
    const invoice = await createNowPaymentsInvoice({ user, origin });
    await persistPaymentRecord({
      id: randomUUID(),
      provider: "nowpayments",
      providerReference: String(invoice.id),
      userId: user.id,
      status: invoice.paymentStatus,
      kind: "subscription",
      createdAt: nowIso(),
      checkoutUrl: null,
      payAddress: invoice.payAddress,
      payCurrency: invoice.payCurrency,
      payAmount: invoice.payAmount,
    });
    return invoice;
  }

  throw new Error("Unsupported payment provider.");
}

export async function markPaymentComplete(providerReference, provider) {
  const db = await readDb();
  const payment = db.payments.find((entry) => entry.providerReference === String(providerReference) && entry.provider === provider);
  if (!payment) {
    return null;
  }

  await updateDb((nextDb) => {
    const nextPayment = nextDb.payments.find((entry) => entry.providerReference === String(providerReference) && entry.provider === provider);
    if (nextPayment) {
      nextPayment.status = "finished";
      nextPayment.updatedAt = nowIso();
    }
    return nextDb;
  });

  const renewsAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  return updateUserPlan(payment.userId, "plus", {
    status: "active",
    provider,
    renewsAt,
  });
}

export async function handleStripeWebhook(rawBody, signatureHeader) {
  if (!verifyStripeWebhook(rawBody, signatureHeader)) {
    throw new Error("Invalid Stripe webhook signature.");
  }

  const event = JSON.parse(rawBody);
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object || {};
    const providerReference = session.id;
    const userId = session.metadata?.userId || session.client_reference_id || null;

    if (providerReference) {
      const upgraded = await markPaymentComplete(providerReference, "stripe");
      if (upgraded) {
        return upgraded;
      }
    }

    if (userId) {
      const renewsAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      return updateUserPlan(userId, "plus", {
        status: "active",
        provider: "stripe",
        renewsAt,
      });
    }
  }

  return null;
}

export async function confirmStripePaymentSession(sessionId) {
  const session = await confirmStripeCheckoutSession(sessionId);
  const completed = session.status === "complete" || session.paymentStatus === "paid";

  if (!completed) {
    throw new Error("Stripe checkout is not completed yet.");
  }

  const upgraded = await markPaymentComplete(session.id, "stripe");
  if (upgraded) {
    return upgraded;
  }

  const userId = session.metadata?.userId || session.clientReferenceId;
  if (!userId) {
    throw new Error("Stripe session has no linked user.");
  }

  const renewsAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  return updateUserPlan(userId, "plus", {
    status: "active",
    provider: "stripe",
    renewsAt,
  });
}

export async function handleNowPaymentsWebhook(rawBody, signatureHeader) {
  if (!verifyNowPaymentsSignature(rawBody, signatureHeader || "")) {
    throw new Error("Invalid NOWPayments signature.");
  }

  const event = JSON.parse(rawBody);
  const status = String(event.payment_status || "").toLowerCase();
  if (status === "finished" || status === "confirmed") {
    return markPaymentComplete(event.payment_id, "nowpayments");
  }

  return null;
}
