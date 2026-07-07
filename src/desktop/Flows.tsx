import { useState, useMemo } from 'react';
import { useAppSelector, type RootState } from '../store';
import { useMetals } from '../hooks/useMetals';
import { useTarePresets } from '../hooks/useTarePresets';
import { createReceipt } from '../services/receipts';
import { createSale } from '../services/sales';
import { printComplianceRecord } from './print';
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

// A line on the buy ticket. Weight is captured either as a net figure keyed
// straight in (walk-ins) or as gross − tare (a truck on the scale), matching
// the mobile AddLineItemModal. `net` mirrors the mobile stored net weight.
type WeighMode = 'net' | 'tare';
interface BuyItem {
  id: string;
  mode: WeighMode;
  net: number;
  gross: number;
  tare: number;
}
// Effective net weight for a line — gross minus tare when weighing a vehicle,
// clamped at 0 so a half-entered gross/tare never goes negative.
const netOf = (it: BuyItem): number =>
  it.mode === 'tare'
    ? Math.max(0, (it.gross || 0) - (it.tare || 0))
    : it.net || 0;

const miniLabel = {
  fontSize: 10.5,
  fontWeight: 600,
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
} as const;

// ── Buy intake ──────────────────────────────────────────────────────────────
export function BuyFlow({
  onClose,
  onDone,
  onSaved,
}: {
  onClose: () => void;
  onDone: () => void;
  // Refresh the shell's data after each save without closing the ticket, so a
  // rapid intake session keeps the day book counts current between tickets.
  onSaved?: () => void;
}) {
  const { metals } = useMetals();
  const { presets, create: createPreset } = useTarePresets();
  const list = metals as unknown as MetalRow[];
  const workerId = useAppSelector(
    (s: RootState) => s.auth.activeIdentity?.user_id ?? s.auth.profile?.id ?? ''
  );

  const [seller, setSeller] = useState('');
  const [dl, setDl] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [affirmed, setAffirmed] = useState(false);
  const [items, setItems] = useState<BuyItem[]>([]);
  const [pay, setPay] = useState<'cash' | 'check'>('cash');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // After a save the ticket flips to a confirmation summary (quick mode) rather
  // than closing, so a busy yard can start the next ticket in one tap.
  const [saved, setSaved] = useState<{
    number: string;
    total: number;
    weight: number;
    items: number;
    seller: string;
    dl: string;
    plate: string;
    affirmed: boolean;
    materials: string;
    pay: string;
    regulated: boolean;
  } | null>(null);

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
    (s, it) => s + netOf(it) * (byId.get(it.id)?.price_per_lb ?? 0),
    0
  );
  const weight = items.reduce((s, it) => s + netOf(it), 0);

  const patch = (idx: number, p: Partial<BuyItem>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const addMetal = (id: string) => {
    setItems([...items, { id, mode: 'net', net: 0, gross: 0, tare: 0 }]);
    setAdding(false);
  };

  // Start a fresh ticket after a save. `keepSeller` carries the seller's name +
  // license over for a regular dropping multiple loads; everything transaction-
  // specific (materials, vehicle, affirmation, payment) always resets, and the
  // ownership affirmation is re-taken per ticket.
  const reset = (keepSeller: boolean) => {
    setItems([]);
    setVehiclePlate('');
    setAffirmed(false);
    setPay('cash');
    setAdding(false);
    setErr(null);
    setSaved(null);
    if (!keepSeller) {
      setSeller('');
      setDl('');
    }
  };

  // Save the tare an operator just keyed as a reusable preset (e.g. a regular's
  // truck), so next time they pick it instead of re-weighing empty.
  const savePreset = async (tare: number) => {
    if (!tare || tare <= 0) return;
    const name =
      typeof window !== 'undefined' && window.prompt
        ? window.prompt('Name this tare (e.g. Blue Peterbilt)')?.trim()
        : '';
    if (!name) return;
    try {
      await createPreset({
        name,
        tareWeight: tare,
        createdBy: workerId || null,
      });
    } catch (e) {
      setErr((e as Error).message);
    }
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
        const net = netOf(it);
        return {
          metalId: m.id,
          metalName: m.name,
          weight: net,
          // Persist the scale reading only when tare was actually used, so a
          // straight net entry doesn't record a phantom 0-lb gross/tare.
          grossWeight: it.mode === 'tare' ? it.gross || 0 : null,
          tareWeight: it.mode === 'tare' ? it.tare || 0 : null,
          pricePerLb: m.price_per_lb,
          originalPricePerLb: m.price_per_lb,
          isPriceOverride: false,
          overrideApprovedBy: null,
          total: net * m.price_per_lb,
          isRegulated: !!m.is_regulated,
          isRestricted: !!m.is_restricted,
          isCatalytic: !!m.is_catalytic,
        };
      });
      const receipt = await createReceipt({
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
      // Refresh the shell's data behind the slide-over, then show the summary
      // (quick mode) instead of closing so the next ticket is one tap away.
      onSaved?.();
      setSaved({
        number: (receipt as { receipt_number?: string })?.receipt_number ?? '—',
        total,
        weight,
        items: items.length,
        seller: seller.trim(),
        dl: dl.trim(),
        plate: vehiclePlate.trim(),
        affirmed: needsCompliance ? affirmed : false,
        materials: items
          .map((it) => byId.get(it.id)?.name)
          .filter(Boolean)
          .join(', '),
        pay: effectivePay,
        regulated: needsCompliance,
      });
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
      {saved ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 12,
                paddingTop: 18,
              }}
            >
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 17,
                  background: 'var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name="check"
                  size={31}
                  color="var(--accent)"
                  stroke={2.4}
                />
              </div>
              <div>
                <div
                  className="exp"
                  style={{
                    fontSize: 21,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: -0.4,
                  }}
                >
                  Ticket saved
                </div>
                <div
                  className="mono num"
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-3)',
                    marginTop: 4,
                  }}
                >
                  {saved.number}
                </div>
              </div>
            </div>
            <Card pad={18}>
              {(
                [
                  ['Paid', money(saved.total)],
                  ['Weight', `${lbs(saved.weight)} lb`],
                  ['Items', String(saved.items)],
                  ['Seller', saved.seller || 'Walk-in'],
                ] as const
              ).map(([k, v], idx, arr) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '11px 0',
                    borderBottom:
                      idx < arr.length - 1 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                    {k}
                  </span>
                  <span
                    className="mono num"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </Card>
          </div>
          {/* quick-mode actions — next ticket in one tap */}
          <div
            style={{
              padding: '18px 22px',
              borderTop: '1px solid var(--line)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <Btn
              variant="primary"
              icon="plus"
              full
              onClick={() => reset(false)}
            >
              New ticket
            </Btn>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" icon="scan" full onClick={() => reset(true)}>
                Same seller
              </Btn>
              <Btn variant="ghost" full onClick={onDone}>
                Done
              </Btn>
            </div>
            <Btn
              variant="ghost"
              icon="printer"
              full
              onClick={() =>
                printComplianceRecord({
                  no: saved.number,
                  seller: saved.seller || 'Walk-in',
                  dl: saved.dl || '—',
                  plate: saved.plate || '—',
                  vehicle: '—',
                  materials: saved.materials,
                  weight: saved.weight,
                  paid: saved.total,
                  pay: saved.pay,
                  affirmed: saved.affirmed,
                }).catch(() => {})
              }
            >
              {saved.regulated ? 'Print purchase record' : 'Print record'}
            </Btn>
          </div>
        </div>
      ) : (
        <>
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
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
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
                  <Icon
                    name="plus"
                    size={14}
                    color="var(--accent)"
                    stroke={2.4}
                  />
                  Add metal
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.map((it, i) => {
                  const m = byId.get(it.id);
                  if (!m) return null;
                  const net = netOf(it);
                  const sub = net * m.price_per_lb;
                  const wInput = {
                    height: 34,
                    textAlign: 'right' as const,
                    border: '1px solid var(--line)',
                    borderRadius: 9,
                    background: 'var(--surface-2)',
                    color: 'var(--ink)',
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '0 8px',
                    outline: 'none',
                  };
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        borderLeft: `3px solid ${metalTone(m)}`,
                      }}
                    >
                      {/* header: metal · subtotal · remove */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
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
                              style={{
                                color: tierTone(tierOf(m)),
                                fontWeight: 600,
                              }}
                            >
                              {tierOf(m)}
                            </span>
                          </div>
                        </div>
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

                      {/* weigh-in — key net directly, or gross − tare on the scale */}
                      <div
                        style={{
                          marginTop: 11,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 9,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['net', 'tare'] as const).map((md) => {
                            const on = it.mode === md;
                            return (
                              <button
                                key={md}
                                className="tap mono"
                                onClick={() => patch(i, { mode: md })}
                                style={{
                                  flex: 1,
                                  padding: '7px 0',
                                  borderRadius: 8,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  letterSpacing: 0.3,
                                  textTransform: 'uppercase',
                                  background: on
                                    ? 'var(--accent-soft)'
                                    : 'var(--surface-2)',
                                  color: on ? 'var(--accent)' : 'var(--ink-3)',
                                  border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`,
                                }}
                              >
                                {md === 'net' ? 'Net weight' : 'Gross − tare'}
                              </button>
                            );
                          })}
                        </div>
                        {it.mode === 'net' ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 7,
                            }}
                          >
                            <input
                              type="number"
                              value={it.net || ''}
                              onChange={(e) =>
                                patch(i, { net: Number(e.target.value) })
                              }
                              placeholder="0"
                              className="mono num"
                              style={{ ...wInput, width: 100 }}
                            />
                            <span
                              className="mono"
                              style={{ fontSize: 11, color: 'var(--ink-3)' }}
                            >
                              lb
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={miniLabel}>Gross</span>
                              <input
                                type="number"
                                value={it.gross || ''}
                                onChange={(e) =>
                                  patch(i, { gross: Number(e.target.value) })
                                }
                                placeholder="0"
                                className="mono num"
                                style={{ ...wInput, width: 76 }}
                              />
                              <span
                                style={{
                                  color: 'var(--ink-3)',
                                  fontWeight: 600,
                                }}
                              >
                                −
                              </span>
                              <span style={miniLabel}>Tare</span>
                              <input
                                type="number"
                                value={it.tare || ''}
                                onChange={(e) =>
                                  patch(i, { tare: Number(e.target.value) })
                                }
                                placeholder="0"
                                className="mono num"
                                style={{ ...wInput, width: 76 }}
                              />
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: 5,
                                }}
                              >
                                <span style={miniLabel}>Net</span>
                                <span
                                  className="mono num"
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color:
                                      net > 0 ? 'var(--ink)' : 'var(--ink-3)',
                                  }}
                                >
                                  {lbs(net)} lb
                                </span>
                              </span>
                            </div>
                            {/* saved tares — pick a regular's rig, or save this one */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                              }}
                            >
                              <select
                                value=""
                                onChange={(e) => {
                                  const p = presets.find(
                                    (x) => x.id === e.target.value
                                  );
                                  if (p) patch(i, { tare: p.tare_weight });
                                }}
                                className="mono"
                                style={{
                                  flex: 1,
                                  height: 32,
                                  padding: '0 8px',
                                  background: 'var(--surface-2)',
                                  border: '1px solid var(--line)',
                                  borderRadius: 8,
                                  color: presets.length
                                    ? 'var(--ink-2)'
                                    : 'var(--ink-3)',
                                  fontSize: 12,
                                  outline: 'none',
                                }}
                              >
                                <option value="">
                                  {presets.length
                                    ? 'Tare preset…'
                                    : 'No saved tares yet'}
                                </option>
                                {presets.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} — {lbs(p.tare_weight)} lb
                                  </option>
                                ))}
                              </select>
                              <button
                                className="tap mono"
                                onClick={() => savePreset(it.tare)}
                                disabled={!it.tare}
                                style={{
                                  height: 32,
                                  padding: '0 11px',
                                  borderRadius: 8,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: 'var(--surface)',
                                  border: '1px solid var(--line)',
                                  color: it.tare
                                    ? 'var(--accent)'
                                    : 'var(--ink-3)',
                                  opacity: it.tare ? 1 : 0.5,
                                }}
                              >
                                <Icon
                                  name="plus"
                                  size={13}
                                  color={
                                    it.tare ? 'var(--accent)' : 'var(--ink-3)'
                                  }
                                  stroke={2.4}
                                />
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
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
                  <Icon
                    name="shield"
                    size={18}
                    color={tierTone(tier)}
                    stroke={2}
                  />
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
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
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
                    background: affirmed
                      ? 'var(--accent-soft)'
                      : 'var(--surface)',
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
                    style={{
                      fontSize: 13,
                      color: 'var(--ink-2)',
                      lineHeight: 1.4,
                    }}
                  >
                    Seller affirms lawful ownership of the material.
                  </span>
                </button>
              </div>
            )}

            {/* payment */}
            <div>
              <GroupLabel style={{ marginBottom: 9 }}>
                Payment method
              </GroupLabel>
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
                        background: on
                          ? 'var(--accent-soft)'
                          : 'var(--surface)',
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
              <div
                className="mono"
                style={{ fontSize: 12, color: 'var(--rust)' }}
              >
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
                  style={{
                    fontSize: 11.5,
                    color: 'var(--ink-3)',
                    marginTop: 2,
                  }}
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
        </>
      )}
    </SlideOver>
  );
}

// ── Sale ────────────────────────────────────────────────────────────────────
export function SaleFlow({
  onClose,
  onDone,
  onSaved,
}: {
  onClose: () => void;
  onDone: () => void;
  // Refresh the shell's data after each load without closing (quick mode).
  onSaved?: () => void;
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
  const [saved, setSaved] = useState<{
    loadNo: string;
    total: number;
    weight: number;
    buyer: string;
    metal: string;
  } | null>(null);

  const metal = list.find((m) => m.id === metalId) || list[0];
  const total = weight * price;
  const canSave = !!metal && weight > 0 && price > 0 && !busy;

  // Start a fresh load after a save; keepBuyer carries the processor over for a
  // yard shipping several loads to the same mill.
  const reset = (keepBuyer: boolean) => {
    setMetalId('');
    setWeight(0);
    setPrice(0);
    setErr(null);
    setSaved(null);
    if (!keepBuyer) setBuyer('');
  };

  const complete = async () => {
    if (!canSave || !metal) return;
    setBusy(true);
    setErr(null);
    try {
      const sale = await createSale({
        metalId: metal.id,
        metalName: metal.name,
        weight,
        salePricePerLb: price,
        costBasisPerLb: 0,
        buyerName: buyer.trim() || undefined,
        workerId,
      });
      onSaved?.();
      const id = (sale as { id?: string })?.id ?? '';
      setSaved({
        loadNo: id ? 'SO-' + id.slice(0, 8) : '—',
        total,
        weight,
        buyer: buyer.trim(),
        metal: metal.name,
      });
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
      {saved ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 12,
                paddingTop: 18,
              }}
            >
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 17,
                  background:
                    'color-mix(in oklab, var(--teal) 15%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="check" size={31} color="var(--teal)" stroke={2.4} />
              </div>
              <div>
                <div
                  className="exp"
                  style={{
                    fontSize: 21,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: -0.4,
                  }}
                >
                  Load shipped
                </div>
                <div
                  className="mono num"
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-3)',
                    marginTop: 4,
                  }}
                >
                  {saved.loadNo}
                </div>
              </div>
            </div>
            <Card pad={18}>
              {(
                [
                  ['Revenue', money(saved.total)],
                  ['Material', saved.metal],
                  ['Weight', `${lbs(saved.weight)} lb`],
                  ['Processor', saved.buyer || '—'],
                ] as const
              ).map(([k, v], idx, arr) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '11px 0',
                    borderBottom:
                      idx < arr.length - 1 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                    {k}
                  </span>
                  <span
                    className="mono num"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </Card>
          </div>
          <div
            style={{
              padding: '18px 22px',
              borderTop: '1px solid var(--line)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <Btn
              variant="primary"
              tone="var(--teal)"
              icon="plus"
              full
              onClick={() => reset(false)}
            >
              New load
            </Btn>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn
                variant="ghost"
                icon="truck"
                full
                onClick={() => reset(true)}
              >
                Same processor
              </Btn>
              <Btn variant="ghost" full onClick={onDone}>
                Done
              </Btn>
            </div>
          </div>
        </div>
      ) : (
        <>
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
                background:
                  'color-mix(in oklab, var(--teal) 7%, var(--surface))',
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
              <div
                className="mono"
                style={{ fontSize: 12, color: 'var(--rust)' }}
              >
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
        </>
      )}
    </SlideOver>
  );
}
