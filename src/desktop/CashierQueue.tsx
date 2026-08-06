import { useState } from 'react';
import { useDraftTickets } from '../hooks/useDraftTickets';
import { type DraftTicket, voidDraftTicket } from '../services/draftTickets';
import {
  SlideOver,
  SlideHead,
  Card,
  Btn,
  EmptyState,
  SkeletonRows,
  money,
  lbs,
} from './ui';

// The front-desk queue: pending scale tickets a worker sent from the scale. The
// cashier picks one (by claim # off the customer's stub, or from the list) and
// finalizes the payout — collecting ID/photos/payment. Polls so new tickets
// appear without a refresh.
export default function CashierQueue({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (d: DraftTicket) => void;
}) {
  const { drafts, loading, error, refresh } = useDraftTickets();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Void a mistaken/abandoned ticket so it leaves the queue — the counterpart to
  // the "void it in the cashier queue" instruction the double-payout warning
  // gives. voidDraftTicket only flips status to 'voided' (no money/inventory
  // moves); pending is the only voidable state.
  const handleVoid = async (d: DraftTicket) => {
    if (
      !window.confirm(
        `Void ticket ${d.claim_number}? It will leave the queue and can't be finalized.`
      )
    ) {
      return;
    }
    setVoidingId(d.id);
    setActionError(null);
    try {
      await voidDraftTicket(d.id);
      await refresh();
    } catch (error_) {
      setActionError((error_ as Error).message);
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <SlideOver open onClose={onClose} width={480}>
      <SlideHead
        title="Cashier queue"
        sub={`${drafts.length} ticket${drafts.length === 1 ? '' : 's'} waiting`}
        onClose={onClose}
        icon="user"
      />
      <div
        className="screen-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {actionError && (
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: 'var(--rust)',
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            {actionError}
          </div>
        )}
        {error ? (
          <EmptyState
            tone="error"
            label="Couldn’t load the queue"
            sub={error}
            action={
              <Btn variant="ghost" size="sm" icon="reload" onClick={refresh}>
                Retry
              </Btn>
            }
          />
        ) : loading && drafts.length === 0 ? (
          <SkeletonRows rows={3} />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon="check"
            label="No tickets waiting"
            sub="Weighed tickets a worker sends to the cashier land here."
          />
        ) : (
          drafts.map((d) => {
            const mats = (d.line_items ?? [])
              .map((li) => li.metalName)
              .join(', ');
            // A ticket can be weight, pieces, or a mix — show whichever it has.
            const pcs = (d.line_items ?? []).reduce(
              (a, li) =>
                a + (li.unit === 'each' ? Number(li.quantity ?? 0) : 0),
              0
            );
            const amountLabel = [
              Number(d.weight || 0) > 0 ? `${lbs(Number(d.weight))} lb` : '',
              pcs > 0 ? `${pcs} pcs` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            const time = new Date(d.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });
            return (
              <Card
                key={d.id}
                hover
                onClick={() => onPick(d)}
                pad={16}
                style={{ cursor: 'pointer' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="exp"
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: 'var(--accent)',
                        letterSpacing: -0.3,
                      }}
                    >
                      {d.claim_number}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--ink-2)',
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 240,
                      }}
                    >
                      {d.seller_name || 'Walk-in'} · {mats || '—'}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-3)',
                        marginTop: 3,
                      }}
                    >
                      {amountLabel || '—'} · {time}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      className="mono num"
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--ink)',
                      }}
                    >
                      {money(Number(d.subtotal || 0))}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: 'var(--accent)',
                        marginTop: 3,
                      }}
                    >
                      Pay out →
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        // Don't let the void click bubble to the card's
                        // finalize handler.
                        e.stopPropagation();
                        void handleVoid(d);
                      }}
                      disabled={voidingId === d.id}
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        fontFamily: 'inherit',
                        color: 'var(--rust)',
                        background: 'transparent',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '3px 10px',
                        cursor: voidingId === d.id ? 'default' : 'pointer',
                        opacity: voidingId === d.id ? 0.6 : 1,
                      }}
                    >
                      {voidingId === d.id ? 'Voiding…' : 'Void'}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </SlideOver>
  );
}
