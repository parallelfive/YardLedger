import { useDraftTickets } from '../hooks/useDraftTickets';
import { type DraftTicket } from '../services/draftTickets';
import Icon from './Icon';
import { SlideOver, SlideHead, Card, money, lbs } from './ui';

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
  const { drafts, loading } = useDraftTickets();

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
        {loading && drafts.length === 0 ? (
          <div
            className="mono"
            style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
          >
            Loading…
          </div>
        ) : drafts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--ink-3)',
            }}
          >
            <Icon name="check" size={30} color="var(--ink-3)" stroke={1.8} />
            <div style={{ fontSize: 13.5, marginTop: 10 }}>
              No tickets waiting. Weighed tickets sent to the cashier land here.
            </div>
          </div>
        ) : (
          drafts.map((d) => {
            const mats = (d.line_items ?? [])
              .map((li) => li.metalName)
              .join(', ');
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
                      {lbs(Number(d.weight || 0))} lb · {time}
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
