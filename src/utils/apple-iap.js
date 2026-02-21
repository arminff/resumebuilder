/**
 * Apple In-App Purchase: legacy verifyReceipt API (Option A).
 * Validates iOS App Store receipt and returns subscription product + expiry for the given plan.
 * Use APPLE_SHARED_SECRET from App Store Connect → App → App Information → App-Specific Shared Secret.
 */

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

/** Status 21007 = sandbox receipt sent to production → retry with sandbox */
const STATUS_SANDBOX_RECEIPT = 21007;

const VALID_PLAN_IDS = ['basic', 'pro'];

/** Parse Apple date string (e.g. "2025-03-01 12:00:00 Etc/GMT") to ms, or return 0 */
function parseAppleDateToMs(value) {
  if (!value) return 0;
  const n = parseInt(value, 10);
  if (!Number.isNaN(n) && n > 0) return n;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Verify receipt with Apple. Tries production first; if Apple returns 21007, retries with sandbox.
 * @param {string} receiptBase64 - Base64-encoded App Store receipt
 * @returns {Promise<{ productId: string, expiresDateMs: number, originalTransactionId?: string } | { error: string }>}
 */
export async function verifyAppleReceipt(receiptBase64) {
  const sharedSecret = process.env.APPLE_SHARED_SECRET;
  if (!sharedSecret) {
    console.error('❌ APPLE_SHARED_SECRET not configured');
    return { error: 'Apple IAP not configured' };
  }

  const body = {
    'receipt-data': receiptBase64,
    password: sharedSecret,
  };

  let lastStatus = null;
  let lastResponse = null;

  for (const url of [APPLE_PRODUCTION_URL, APPLE_SANDBOX_URL]) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      lastStatus = data.status;
      lastResponse = data;

      if (data.status === 0) {
        return parseSubscriptionFromReceipt(data);
      }
      if (data.status === STATUS_SANDBOX_RECEIPT) {
        continue; // retry with sandbox
      }
      // Other error: invalid receipt, expired, etc.
      console.warn('Apple verifyReceipt non-ok status:', data.status, data);
      return { error: 'Invalid or expired receipt' };
    } catch (err) {
      console.error('Apple verifyReceipt request failed:', err);
      return { error: 'Failed to verify purchase' };
    }
  }

  if (lastStatus === STATUS_SANDBOX_RECEIPT) {
    return { error: 'Invalid or expired receipt' };
  }
  return { error: lastResponse?.error ?? 'Failed to verify purchase' };
}

/**
 * Parse subscription product_id, expiry, and original_transaction_id from Apple response.
 * Uses latest_receipt_info (subscriptions); picks the item matching our product IDs or the latest expiry.
 */
function parseSubscriptionFromReceipt(data) {
  const latest = data.latest_receipt_info ?? data.receipt?.in_app ?? [];
  if (!Array.isArray(latest) || latest.length === 0) {
    return { error: 'Invalid or expired receipt' };
  }

  // Find subscription entries (we only care about basic/pro)
  const subs = latest.filter(
    (item) => item.product_id && VALID_PLAN_IDS.includes(item.product_id)
  );
  if (subs.length === 0) {
    return { error: 'Invalid or expired receipt' };
  }

  // Use the one with the latest expires_date_ms (most recent period)
  const withExpiry = subs
    .map((item) => {
      const expiresMs = parseInt(item.expires_date_ms, 10) || parseAppleDateToMs(item.expires_date) || 0;
      const purchaseMs = parseInt(item.purchase_date_ms, 10) || parseAppleDateToMs(item.purchase_date) || 0;
      return {
        productId: item.product_id,
        expiresDateMs: expiresMs,
        originalTransactionId: item.original_transaction_id || item.transaction_id,
        purchaseDateMs: purchaseMs,
      };
    })
    .filter((x) => x.expiresDateMs > 0);

  if (withExpiry.length === 0) {
    return { error: 'Invalid or expired receipt' };
  }

  const latestByExpiry = withExpiry.sort((a, b) => b.expiresDateMs - a.expiresDateMs)[0];
  if (Date.now() > latestByExpiry.expiresDateMs) {
    return { error: 'Invalid or expired receipt' };
  }

  return {
    productId: latestByExpiry.productId,
    expiresDateMs: latestByExpiry.expiresDateMs,
    originalTransactionId: latestByExpiry.originalTransactionId,
    purchaseDateMs: latestByExpiry.purchaseDateMs,
  };
}

/**
 * Validate that the requested planId matches the product in the receipt.
 */
export function planIdMatchesReceipt(planId, productId) {
  if (!VALID_PLAN_IDS.includes(planId)) return false;
  return productId === planId;
}
