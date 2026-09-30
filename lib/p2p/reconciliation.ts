import { dbQuery, ensureDatabase } from "@/lib/db";
import { verifyEscrowTransaction, type EscrowChainProof, type EscrowVerificationAction } from "@/lib/p2p/chain-verification";
import { getEscrowAddress } from "@/lib/web3/escrow";

const EVENT_BY_ACTION: Record<EscrowVerificationAction, string> = {
  accept: "Locked",
  mark_paid: "PaymentMarked",
  release: "Released",
  claim: "Claimed",
  refund: "Refunded",
  resolve_buyer: "Claimed",
  resolve_seller: "Refunded"
};

/** Persists an immutable, idempotent record of the confirmed event used by a projection. */
export async function recordConfirmedEscrowEvent(
  tradeId: string,
  action: EscrowVerificationAction,
  proof: EscrowChainProof
): Promise<void> {
  await dbQuery(
    `INSERT INTO p2p_escrow_events
       (trade_id, chain_id, contract_address, event_name, transaction_hash, block_number, block_hash, log_index)
     VALUES ($1, $2, LOWER($3), $4, LOWER($5), $6::NUMERIC, LOWER($7), $8)
     ON CONFLICT (chain_id, contract_address, transaction_hash, log_index) DO NOTHING`,
    [
      tradeId,
      Number(process.env.NEXT_PUBLIC_ESCROW_CHAIN_ID ?? 43114),
      getEscrowAddress(),
      EVENT_BY_ACTION[action],
      proof.transactionHash,
      proof.blockNumber.toString(),
      proof.blockHash,
      proof.logIndex
    ]
  );
}

type ReconciliationRow = {
  trade_id: string;
  trade_ref: string;
  crypto_currency: string;
  crypto_amount: string;
  buyer_wallet_address: string | null;
  seller_wallet_address: string | null;
  status: string;
  escrow_status: string | null;
  tx_hash: string | null;
};

function actionFor(row: ReconciliationRow): EscrowVerificationAction | null {
  if (row.escrow_status === "funded") return "accept";
  if (row.escrow_status === "released") return "release";
  if (row.escrow_status === "claimed") return "claim";
  if (row.escrow_status === "refunded") return "refund";
  return null;
}

/** Re-checks chain-backed escrow projections and records mismatches for operators. */
export async function reconcileEscrowProjections(limit = 50): Promise<{ checked: number; verified: number; failed: number }> {
  await ensureDatabase();
  const rows = await dbQuery<ReconciliationRow>(
    `SELECT t.id::TEXT AS trade_id, t.trade_ref, t.crypto_currency, t.crypto_amount::TEXT AS crypto_amount,
            t.buyer_wallet_address, t.seller_wallet_address, t.status,
            e.status AS escrow_status,
            CASE e.status WHEN 'funded' THEN e.debit_tx_hash
                          WHEN 'released' THEN e.release_tx_hash
                          WHEN 'claimed' THEN e.claim_tx_hash
                          WHEN 'refunded' THEN e.refund_tx_hash END AS tx_hash
     FROM p2p_trades t
     JOIN LATERAL (SELECT * FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1) e ON TRUE
     WHERE e.status IN ('funded', 'released', 'claimed', 'refunded')
       AND e.chain_verified_at IS NULL
     ORDER BY e.created_at ASC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)]
  );

  return reconcileRows(rows);
}

async function reconcileRows(rows: ReconciliationRow[]): Promise<{ checked: number; verified: number; failed: number }> {

  let verified = 0;
  let failed = 0;
  for (const row of rows) {
    const action = actionFor(row);
    if (!action || !row.tx_hash) {
      failed += 1;
      continue;
    }
    try {
      const proof = await verifyEscrowTransaction({
        action,
        txHash: row.tx_hash,
        tradeRef: row.trade_ref,
        cryptoCurrency: row.crypto_currency,
        cryptoAmount: Number(row.crypto_amount),
        buyerWalletAddress: row.buyer_wallet_address,
        sellerWalletAddress: row.seller_wallet_address,
        destinationAddress: row.escrow_status === "claimed" ? undefined : row.seller_wallet_address ?? undefined
      });
      await recordConfirmedEscrowEvent(row.trade_id, action, proof);
      await dbQuery(
        `UPDATE p2p_escrow SET chain_block_number = $2, chain_log_index = $3,
           chain_verified_at = NOW(), chain_verifier_version = 'escrow-events-v1'
         WHERE trade_id = $1`,
        [row.trade_id, proof.blockNumber.toString(), proof.logIndex]
      );
      verified += 1;
    } catch (error) {
      failed += 1;
      await dbQuery(
        `UPDATE p2p_trades SET status = 'reconciliation_required', updated_at = NOW() WHERE id = $1`,
        [row.trade_id]
      );
      console.error("Escrow reconciliation failed", { tradeId: row.trade_id, error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return { checked: rows.length, verified, failed };
}

/** Rechecks one trade when it is opened or acted on. */
export async function reconcileEscrowTrade(tradeId: string): Promise<{ checked: number; verified: number; failed: number }> {
  await ensureDatabase();
  const rows = await dbQuery<ReconciliationRow>(
    `SELECT t.id::TEXT AS trade_id, t.trade_ref, t.crypto_currency, t.crypto_amount::TEXT AS crypto_amount,
            t.buyer_wallet_address, t.seller_wallet_address, t.status,
            e.status AS escrow_status,
            CASE e.status WHEN 'funded' THEN e.debit_tx_hash
                          WHEN 'released' THEN e.release_tx_hash
                          WHEN 'claimed' THEN e.claim_tx_hash
                          WHEN 'refunded' THEN e.refund_tx_hash END AS tx_hash
     FROM p2p_trades t
     JOIN LATERAL (SELECT * FROM p2p_escrow WHERE trade_id = t.id ORDER BY id DESC LIMIT 1) e ON TRUE
     WHERE t.id = $1
       AND e.status IN ('funded', 'released', 'claimed', 'refunded')
       AND e.chain_verified_at IS NULL
     LIMIT 1`,
    [tradeId]
  );
  return reconcileRows(rows);
}

/** Resolves a provider webhook hash to a stored escrow action, then verifies it from chain data. */
export async function reconcileEscrowTransaction(txHash: string): Promise<{ checked: number; verified: number; failed: number }> {
  await ensureDatabase();
  const rows = await dbQuery<{ trade_id: string }>(
    `SELECT trade_id::TEXT AS trade_id
     FROM p2p_escrow
     WHERE LOWER(debit_tx_hash) = LOWER($1)
        OR LOWER(release_tx_hash) = LOWER($1)
        OR LOWER(claim_tx_hash) = LOWER($1)
        OR LOWER(refund_tx_hash) = LOWER($1)
     ORDER BY id DESC LIMIT 1`,
    [txHash]
  );
  if (!rows[0]) return { checked: 0, verified: 0, failed: 0 };
  return reconcileEscrowTrade(rows[0].trade_id);
}
