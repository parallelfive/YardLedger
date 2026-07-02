import { useState, useMemo } from 'react';
import { useAppSelector, type RootState } from '../store';
import { useMetals } from '../hooks/useMetals';
import { createReceipt } from '../services/receipts';
import { createSale } from '../services/sales';
import type { LineItemInput } from '../types';
import Icon from './Icon';
import {
  Card,
  SlideOver,
  SlideHead,
  GroupLabel,
  Pill,
  Btn,
  Field,
  TextInput,
  MetalDot,
  money,
  lbs,
  toneColor,
  tierTone,
} from './ui';

// Real metal row from useMetals (select('*')).
interface MetalRow {
  id: string;
  name: string;
  price_per_lb: number;
  is_restricted?: boolean;
  is_regulated?: boolean;
  is_catalytic?: boolean;
}

type Tier = 'open' | 'regulated' | 'restricted' | 'catalytic';
const TIER_NOTE: Record<Tier, string> = {
  open: 'No documentation required.',
  regulated: 'Seller ID, vehicle & ownership affirmation required.',
  restricted: 'Adds written proof of ownership.',
  catalytic: 'Check only · VIN + serials · 60-day hold.',
};
const tierOf = (m: MetalRow): Tier =>
  m.is_catalytic
    ? 'catalytic'
    : m.is_restricted
      ? 'restricted'
      : m.is_regulated
        ? 'regulated'
        : 'open';
const metalTone = (m: MetalRow): string =>
  toneColor(tierOf(m) === 'open' ? 'moss' : tierTone(tierOf(m)));

const RANK: Record<Tier, number> = {
  open: 0,
  regulated: 1,
  restricted: 2,
  catalytic: 3,
};

// ── Buy intake ──────────────────────────────────────────────────────────────
export function BuyFlow({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { metals } = useMetals();
  const list = metals as unknown as MetalRow[];
  const workerId = useAppSelector(
    (s: RootState) => s.auth.activeIdentity?.user_id ?? s.auth.profile?.id ?? ''
  );

  const [seller, setSeller] = useState('');
  const [dl, setDl] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [affirmed, setAffirmed] = useState(false);
  const [items, setItems] = useState<{ id: string; weight: number }[]>([]);
  const [pay, setPay] = useState<'cash' | 'check'>('cash');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);

  const tier: Tier | null = useMemo(() => {
    if (items.length === 0) return null;
    return items
      .map((it) => byId.get(it.id))
      .filter((m): m is MetalRow => !!m)
      .reduce<Tier>(
        (acc, m) => (RANK[tierOf(m)] > RANK[acc] ? tierOf(m) : acc),
        'open'
      );
  }, [items, byId]);

  const checkOnly = tier === 'catalytic';
  const effectivePay: 'cash' | 'check' = checkOnly ? 'check' : pay;
  const total = items.reduce(
    (s, it) => s + it.weight * (byId.get(it.id)?.price_per_lb ?? 0),
    0
  );
  const weight = items.reduce((s, it) => s + it.weight, 0);

  const setW = (idx: number, w: number) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, weight: w } : it)));
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const addMetal = (id: string) => {
    setItems([...items, { id, weight: 0 }]);
    setAdding(false);
  };

  // Regulated / restricted / catalytic buys legally require seller ID, a
  // vehicle, and an ownership affirmation — capture and require them here so the
  // desktop can't create an incomplete compliance record (mobile gates these in
  // its stepper).
  const needsCompliance = tier !== null && tier !== 'open';
  const complianceOk =
    !needsCompliance || (!!dl.trim() && !!vehiclePlate.trim() && affirmed);
  const canSave =
    items.length > 0 && weight > 0 && !!seller.trim() && complianceOk && !busy;

  // Tell the operator exactly what's blocking the save (a regulated buy needs
  // ID + vehicle + affirmation), so a disabled button is never a mystery.
  const disabledReason =
    items.length === 0
      ? 'Add a material to start the ticket'
      : weight <= 0
        ? 'Enter a weight'
        : !seller.trim()
          ? "Enter the seller's name"
          : needsCompliance && !dl.trim()
            ? `${tier} buy — enter the driver license`
            : needsCompliance && !vehiclePlate.trim()
              ? `${tier} buy — enter the vehicle plate`
              : needsCompliance && !affirmed
                ? `${tier} buy — confirm the ownership affirmation`
                : null;

  const complete = async () => {
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    try {
      const lineItems: LineItemInput[] = items.map((it) => {
        const m = byId.get(it.id)!;
        return {
          metalId: m.id,
          metalName: m.name,
          weight: it.weight,
          pricePerLb: m.price_per_lb,
          originalPricePerLb: m.price_per_lb,
          isPriceOverride: false,
          overrideApprovedBy: null,
          total: it.weight * m.price_per_lb,
          isRegulated: !!m.is_regulated,
          isRestricted: !!m.is_restricted,
          isCatalytic: !!m.is_catalytic,
        };
      });
      await createReceipt({
        customerName: seller.trim(),
        customerPhone: '',
        type: 'buy',
        subtotal: total,
        workerId,
        paymentMethod: effectivePay,
        isCatalytic: tier === 'catalytic',
        sellerName: seller.trim() || undefined,
        sellerDlNumber: dl.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        sellerAffirmed: needsCompliance ? affirmed : undefined,
        lineItems,
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SlideOver open onClose={onClose} width={560}>
      <SlideHead
        title="New buy"
        sub="Intake ticket"
        onClose={onClose}
        icon="receipt"
      />
      <div
        className="screen-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {/* seller */}
        <div>
          <GroupLabel style={{ marginBottom: 9 }}>Seller</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Name">
              <TextInput
                value={seller}
                onChange={setSeller}
                placeholder="Seller full name"
              />
            </Field>
            <Field label="Driver license (regulated)">
              <TextInput
                value={dl}
                onChange={setDl}
                placeholder="DL number"
                mono
              />
            </Field>
          </div>
        </div>

        {/* line items */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 9,
            }}
          >
            <GroupLabel>Materials · {items.length}</GroupLabel>
            <button
              className="tap mono"
              onClick={() => setAdding((a) => !a)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Icon name="plus" size={14} color="var(--accent)" stroke={2.4} />
              Add metal
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.map((it, i) => {
              const m = byId.get(it.id);
              if (!m) return null;
              const sub = it.weight * m.price_per_lb;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    borderLeft: `3px solid ${metalTone(m)}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.name}
                    </div>
                    <div
                      className="mono num"
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-3)',
                        marginTop: 3,
                      }}
                    >
                      {money(m.price_per_lb)}/lb ·{' '}
                      <span
                        style={{ color: tierTone(tierOf(m)), fontWeight: 600 }}
                      >
                        {tierOf(m)}
                      </span>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={it.weight || ''}
                    onChange={(e) => setW(i, Number(e.target.value))}
                    className="mono num"
                    style={{
                      width: 72,
                      height: 36,
                      textAlign: 'right',
                      border: '1px solid var(--line)',
                      borderRadius: 9,
                      background: 'var(--surface-2)',
                      color: 'var(--ink)',
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '0 8px',
                      outline: 'none',
                    }}
                  />
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--ink-3)' }}
                  >
                    lb
                  </span>
                  <span
                    className="mono num"
                    style={{
                      width: 78,
                      textAlign: 'right',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--ink)',
                    }}
                  >
                    {money(sub)}
                  </span>
                  <button
                    className="tap"
                    onClick={() => remove(i)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--ink-3)',
                    }}
                  >
                    <Icon
                      name="x"
                      size={15}
                      color="var(--ink-3)"
                      stroke={2.2}
                    />
                  </button>
                </div>
              );
            })}
            {items.length === 0 && (
              <div
                className="mono"
                style={{ fontSize: 12, color: 'var(--ink-3)' }}
              >
                Add a metal to start the ticket.
              </div>
            )}
          </div>
          {adding && (
            <div
              style={{
                marginTop: 9,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 7,
                padding: 12,
                background: 'var(--surface-2)',
                borderRadius: 12,
                border: '1px solid var(--line)',
              }}
            >
              {list
                .filter((m) => !items.find((it) => it.id === m.id))
                .map((m) => (
                  <button
                    key={m.id}
                    className="tap"
                    onClick={() => addMetal(m.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 11px',
                      borderRadius: 99,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      fontSize: 12.5,
                      fontWeight: 550,
                      color: 'var(--ink)',
                    }}
                  >
                    <MetalDot
                      tone={
                        tierOf(m) === 'open'
                          ? 'moss'
                          : (tierTone(tierOf(m)) as string)
                      }
                    />
                    {m.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* compliance banner */}
        {tier && (
          <Card
            pad={16}
            style={{
              border: `1px solid color-mix(in oklab, ${tierTone(tier)} 30%, var(--line))`,
              background: `color-mix(in oklab, ${tierTone(tier)} 7%, var(--surface))`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                marginBottom: 9,
              }}
            >
              <Icon name="shield" size={18} color={tierTone(tier)} stroke={2} />
              <span
                className="exp"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  textTransform: 'capitalize',
                }}
              >
                {tier}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-3)',
                  marginLeft: 'auto',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                governing tier
              </span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--ink-2)',
                lineHeight: 1.5,
                marginBottom: 11,
              }}
            >
              {TIER_NOTE[tier]}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {tier !== 'open' && (
                <Pill tone="var(--ink-3)" icon="scan">
                  Seller ID
                </Pill>
              )}
              {tier !== 'open' && (
                <Pill tone="var(--ink-3)" icon="car">
                  Vehicle
                </Pill>
              )}
              {tier !== 'open' && (
                <Pill tone="var(--ink-3)" icon="sign">
                  Affirmation
                </Pill>
              )}
              {checkOnly && (
                <Pill tone="var(--rust)" icon="x">
                  No cash
                </Pill>
              )}
            </div>
          </Card>
        )}

        {/* regulated capture — required so we never save an incomplete record */}
        {needsCompliance && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <GroupLabel>Required for {tier}</GroupLabel>
            <Field label="Vehicle plate">
              <TextInput
                value={vehiclePlate}
                onChange={setVehiclePlate}
                placeholder="Plate #"
                mono
              />
            </Field>
            <button
              className="tap"
              onClick={() => setAffirmed((a) => !a)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '13px 14px',
                borderRadius: 12,
                textAlign: 'left',
                background: affirmed ? 'var(--accent-soft)' : 'var(--surface)',
                border: `1.5px solid ${affirmed ? 'var(--accent)' : 'var(--line)'}`,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: affirmed ? 'var(--accent)' : 'transparent',
                  border: `1.5px solid ${affirmed ? 'var(--accent)' : 'var(--line-strong)'}`,
                }}
              >
                {affirmed && (
                  <Icon
                    name="check"
                    size={14}
                    color="var(--accent-ink)"
                    stroke={2.6}
                  />
                )}
              </div>
              <span
                style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}
              >
                Seller affirms lawful ownership of the material.
              </span>
            </button>
          </div>
        )}

        {/* payment */}
        <div>
          <GroupLabel style={{ marginBottom: 9 }}>Payment method</GroupLabel>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['cash', 'check'] as const).map((p) => {
              const disabled = checkOnly && p === 'cash';
              const on = effectivePay === p;
              return (
                <button
                  key={p}
                  className="tap"
                  disabled={disabled}
                  onClick={() => setPay(p)}
                  style={{
                    flex: 1,
                    padding: '13px',
                    borderRadius: 12,
                    background: on ? 'var(--accent-soft)' : 'var(--surface)',
                    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: disabled ? 0.45 : 1,
                    color: on ? 'var(--accent)' : 'var(--ink)',
                    fontSize: 14,
                    fontWeight: 650,
                    textTransform: 'capitalize',
                  }}
                >
                  <Icon
                    name={p === 'cash' ? 'receipt' : 'edit'}
                    size={17}
                    color={on ? 'var(--accent)' : 'var(--ink-2)'}
                    stroke={1.9}
                  />
                  {p}
                  {disabled && (
                    <span
                      className="mono"
                      style={{ fontSize: 9.5, color: 'var(--rust)' }}
                    >
                      locked
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {err && (
          <div className="mono" style={{ fontSize: 12, color: 'var(--rust)' }}>
            {err}
          </div>
        )}
      </div>

      {/* footer */}
      <div
        style={{
          padding: '18px 22px',
          borderTop: '1px solid var(--line)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              Total payout · {effectivePay}
            </div>
            <div
              className="mono num"
              style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}
            >
              {lbs(weight)} lb · {items.length} item
              {items.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div
            className="exp num"
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: -1,
            }}
          >
            {money(total)}
          </div>
        </div>
        {disabledReason && !busy && (
          <div
            className="mono"
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--gold)',
              textAlign: 'center',
              textTransform: 'capitalize',
              marginBottom: 10,
            }}
          >
            {disabledReason}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            icon="check"
            full
            disabled={!canSave}
            onClick={complete}
          >
            {busy ? 'Saving…' : 'Complete & save'}
          </Btn>
        </div>
      </div>
    </SlideOver>
  );
}

// ── Sale ────────────────────────────────────────────────────────────────────
export function SaleFlow({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { metals } = useMetals();
  const list = metals as unknown as MetalRow[];
  const workerId = useAppSelector(
    (s: RootState) => s.auth.activeIdentity?.user_id ?? s.auth.profile?.id ?? ''
  );

  const [buyer, setBuyer] = useState('');
  const [metalId, setMetalId] = useState('');
  const [weight, setWeight] = useState(0);
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const metal = list.find((m) => m.id === metalId) || list[0];
  const total = weight * price;
  const canSave = !!metal && weight > 0 && price > 0 && !busy;

  const complete = async () => {
    if (!canSave || !metal) return;
    setBusy(true);
    setErr(null);
    try {
      await createSale({
        metalId: metal.id,
        metalName: metal.name,
        weight,
        salePricePerLb: price,
        costBasisPerLb: 0,
        buyerName: buyer.trim() || undefined,
        workerId,
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SlideOver open onClose={onClose} width={520}>
      <SlideHead
        title="New sale"
        sub="Outbound load to processor"
        onClose={onClose}
        icon="truck"
        tone="var(--teal)"
      />
      <div
        className="screen-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <Field label="Processor / buyer">
          <TextInput
            value={buyer}
            onChange={setBuyer}
            placeholder="e.g. Western Copper Mills"
          />
        </Field>
        <Field label="Material">
          <select
            value={metalId}
            onChange={(e) => setMetalId(e.target.value)}
            style={{
              width: '100%',
              height: 44,
              padding: '0 14px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 11,
              color: 'var(--ink)',
              fontSize: 14.5,
              fontWeight: 550,
              outline: 'none',
            }}
          >
            <option value="">Select a metal…</option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Weight (lb)">
              <TextInput
                value={weight || ''}
                onChange={(v) => setWeight(Number(v) || 0)}
                mono
                align="right"
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Price / lb">
              <TextInput
                value={price || ''}
                onChange={(v) => setPrice(Number(v) || 0)}
                mono
                prefix="$"
                align="right"
              />
            </Field>
          </div>
        </div>
        <Card
          pad={20}
          style={{
            textAlign: 'center',
            background: 'color-mix(in oklab, var(--teal) 7%, var(--surface))',
            border:
              '1px solid color-mix(in oklab, var(--teal) 24%, var(--line))',
          }}
        >
          <GroupLabel>Load total</GroupLabel>
          <div
            className="exp num"
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: 'var(--teal)',
              letterSpacing: -1,
              marginTop: 6,
            }}
          >
            {money(total)}
          </div>
          <div
            className="mono num"
            style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}
          >
            {lbs(weight)} lb @ {money(price)}/lb
          </div>
        </Card>
        {err && (
          <div className="mono" style={{ fontSize: 12, color: 'var(--rust)' }}>
            {err}
          </div>
        )}
      </div>
      <div
        style={{
          padding: '18px 22px',
          borderTop: '1px solid var(--line)',
          background: 'var(--surface)',
          display: 'flex',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          tone="var(--teal)"
          icon="check"
          full
          disabled={!canSave}
          onClick={complete}
        >
          {busy ? 'Saving…' : 'Create load'}
        </Btn>
      </div>
    </SlideOver>
  );
}
