import { useState, useMemo, useEffect } from 'react';
import { useAppSelector, type RootState } from '../store';
import { useMetals } from '../hooks/useMetals';
import { useInventory } from '../hooks/useInventory';
import { useTarePresets } from '../hooks/useTarePresets';
import { createReceipt } from '../services/receipts';
import { createSale } from '../services/sales';
import { useSales } from '../hooks/useSales';
import { searchCustomers, type Customer } from '../services/customers';
import { fetchCompanySettings } from '../services/companySettings';
import {
  createDraftTicket,
  finalizeDraftTicket,
  type DraftTicket,
} from '../services/draftTickets';
import { printComplianceRecord, printClaimStub } from './print';
import { parseAamva, looksLikeAamva } from '../utils/parseAamva';
import { calculateNetWeight } from '../utils/calculations';
import type { LineItemInput } from '../types';
import Icon from './Icon';
import CameraCapture from './CameraCapture';
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
  catalytic: 'Check only · VIN + affidavit · 24-hour hold.',
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
// clamped at 0. Delegates to the shared, unit-tested calculateNetWeight.
const netOf = (it: BuyItem): number => calculateNetWeight(it.mode, it);

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
  draft,
}: {
  onClose: () => void;
  onDone: () => void;
  // Refresh the shell's data after each save without closing the ticket, so a
  // rapid intake session keeps the day book counts current between tickets.
  onSaved?: () => void;
  // When the cashier opens a pending scale ticket, its materials seed the flow
  // and finalizing clears the draft (worker→cashier handoff).
  draft?: DraftTicket;
}) {
  const { metals } = useMetals();
  const { presets, create: createPreset } = useTarePresets();
  const list = metals as unknown as MetalRow[];
  const workerId = useAppSelector(
    (s: RootState) => s.auth.activeIdentity?.user_id ?? s.auth.profile?.id ?? ''
  );

  const [seller, setSeller] = useState(draft?.seller_name ?? '');
  // Seed the materials from a draft (cashier side). Draft line items carry the
  // weigh mode implicitly via gross/tare presence.
  const seedItems = (): BuyItem[] =>
    (draft?.line_items ?? []).map((li) => ({
      id: li.metalId,
      mode: li.grossWeight != null || li.tareWeight != null ? 'tare' : 'net',
      net: Number(li.weight || 0),
      gross: Number(li.grossWeight || 0),
      tare: Number(li.tareWeight || 0),
    }));
  const [dl, setDl] = useState('');
  // Vehicle info is captured at the scale (worker is next to the truck) and
  // rides on the draft; seed it here so the cashier sees it pre-filled and
  // never has to walk outside. Still editable at the desk (hybrid capture).
  const [vehiclePlate, setVehiclePlate] = useState(draft?.vehicle_plate ?? '');
  const [vin, setVin] = useState(draft?.transport_vin ?? '');
  const [affirmed, setAffirmed] = useState(false);
  // NM §57-30-5 requires the seller to attest they have not been convicted of
  // metal theft (separate from the ownership affirmation).
  const [noTheft, setNoTheft] = useState(false);
  // Fields read from the PDF417 barcode on the back of the seller's license by
  // a USB scanner at the desk (see the keydown listener below). Held separately
  // from the manual form — the scan fills name + DL directly, and these ride to
  // the receipt so we capture DOB/address without hand-keying them.
  const [idScan, setIdScan] = useState<{
    dob: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    stateOfIssue: string;
  } | null>(null);
  // Seller ID photo captured from the desktop webcam (data URL until saved).
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  // Returning-seller autofill: as the name is typed we suggest matching
  // customers; picking one fills the license and links the existing record
  // (customerId) instead of creating a duplicate. Flagged sellers surface a
  // warning.
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [sellerFocus, setSellerFocus] = useState(false);
  const [flagged, setFlagged] = useState<{ reason: string } | null>(null);
  const [items, setItems] = useState<BuyItem[]>(seedItems);
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
    vin: string;
    affirmed: boolean;
    noTheft: boolean;
    materials: string;
    pay: string;
    regulated: boolean;
  } | null>(null);
  // The yard's own identity for the printed purchase record (NM requires the
  // dealer's license/registry on the record). Loaded once when the ticket opens.
  const [dealer, setDealer] = useState({ name: '', license: '', registry: '' });
  useEffect(() => {
    let active = true;
    fetchCompanySettings()
      .then((s) => {
        if (active && s)
          setDealer({
            name: s.company_name || '',
            license: s.license_number || '',
            registry: s.registry_id || '',
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);

  // Debounced customer lookup while typing the seller name. Skipped once a
  // suggestion is linked (customerId set) so it doesn't re-search the exact name.
  useEffect(() => {
    const q = seller.trim();
    if (customerId || q.length < 2) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      searchCustomers(q)
        .then((rows) => {
          if (active) setSuggestions(rows.slice(0, 6));
        })
        .catch(() => {
          if (active) setSuggestions([]);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [seller, customerId]);

  const pickCustomer = (c: Customer) => {
    setSeller(c.name);
    setDl(c.drivers_license || '');
    setCustomerId(c.id);
    setSuggestions([]);
    setSellerFocus(false);
    setFlagged(c.is_flagged ? { reason: c.flag_reason } : null);
  };

  // USB ID-scanner autofill (desktop counter). A HID barcode scanner emits the
  // license's PDF417 payload as a keystroke burst (chars a few ms apart) that a
  // human can't reproduce, so we buffer fast keys and, once the burst stops,
  // parse it as AAMVA and fill the seller. Slow human typing gap-resets the
  // buffer and never parses. Once a burst is detected we swallow the keys so the
  // raw payload doesn't land in whatever field has focus.
  useEffect(() => {
    let buf = '';
    let last = 0;
    let hot = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      const raw = buf;
      buf = '';
      hot = false;
      if (raw.length > 40 && looksLikeAamva(raw)) {
        const p = parseAamva(raw);
        if (p.name) setSeller(p.name);
        if (p.driversLicense) setDl(p.driversLicense);
        setCustomerId(null);
        setFlagged(null);
        setIdScan({
          dob: p.dob ?? '',
          address: p.address ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
          zip: p.zip ?? '',
          stateOfIssue: p.stateOfIssue ?? '',
        });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const now = Date.now();
      const gap = now - last;
      last = now;
      if (gap > 60) {
        buf = '';
        hot = false;
      }
      if (e.key === 'Enter') {
        buf += '\n';
        if (hot) e.preventDefault();
      } else if (e.key.length === 1) {
        buf += e.key;
        if (gap > 0 && gap < 30 && buf.length >= 3) hot = true;
        if (hot) e.preventDefault();
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 90);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (timer) clearTimeout(timer);
    };
  }, []);

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
    setVin('');
    setAffirmed(false);
    setNoTheft(false);
    setPay('cash');
    setAdding(false);
    setErr(null);
    setSaved(null);
    setSuggestions([]);
    setIdPhoto(null);
    if (!keepSeller) {
      setSeller('');
      setDl('');
      setCustomerId(null);
      setFlagged(null);
      setIdScan(null);
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
  // Catalytic converters (§57-30-2.4) additionally require the transport
  // vehicle's VIN (17 chars, like the mobile flow).
  const catNeedsVin = tier === 'catalytic';
  const vinOk = !catNeedsVin || vin.trim().length === 17;
  const complianceOk =
    !needsCompliance ||
    (!!dl.trim() && !!vehiclePlate.trim() && affirmed && noTheft && vinOk);
  const canSave =
    items.length > 0 && weight > 0 && !!seller.trim() && complianceOk && !busy;

  // Tell the operator exactly what's blocking the save (a regulated buy needs
  // ID + vehicle + affirmation + no-theft attestation; catalytic also a VIN), so
  // a disabled button is never a mystery.
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
              : catNeedsVin && vin.trim().length !== 17
                ? 'Catalytic buy — enter the 17-character vehicle VIN'
                : needsCompliance && !affirmed
                  ? `${tier} buy — confirm the ownership affirmation`
                  : needsCompliance && !noTheft
                    ? `${tier} buy — confirm the no-theft attestation`
                    : null;

  // Worker "sends" the weighed ticket to the cashier: stage a draft (materials +
  // weights only) and optionally print the claim stub the customer carries to
  // the front. Payment/ID are collected later by the cashier.
  const canSend = items.length > 0 && weight > 0 && !busy;
  const sendToCashier = async (print: boolean) => {
    if (!canSend) return;
    setBusy(true);
    setErr(null);
    try {
      const lineItems = items.map((it) => {
        const m = byId.get(it.id)!;
        const net = netOf(it);
        return {
          metalId: m.id,
          metalName: m.name,
          weight: net,
          grossWeight: it.mode === 'tare' ? it.gross || 0 : null,
          tareWeight: it.mode === 'tare' ? it.tare || 0 : null,
          pricePerLb: m.price_per_lb,
          total: net * m.price_per_lb,
          isRegulated: !!m.is_regulated,
          isRestricted: !!m.is_restricted,
          isCatalytic: !!m.is_catalytic,
        };
      });
      const d = await createDraftTicket({
        workerId,
        sellerName: seller.trim() || undefined,
        lineItems,
        subtotal: total,
        weight,
        // Worker captured these at the scale — carry them to the cashier.
        vehiclePlate: vehiclePlate.trim() || undefined,
        transportVin: vin.trim() || undefined,
      });
      if (print) {
        printClaimStub({
          claimNumber: d.claim_number,
          yardName: dealer.name,
          materials: items
            .map((it) => byId.get(it.id)?.name)
            .filter(Boolean)
            .join(', '),
          weight,
          time: new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        }).catch(() => {});
      }
      onSaved?.();
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

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
        customerId: customerId ?? undefined,
        type: 'buy',
        subtotal: total,
        workerId,
        paymentMethod: effectivePay,
        isCatalytic: tier === 'catalytic',
        sellerName: seller.trim() || undefined,
        sellerDlNumber: dl.trim() || undefined,
        // Captured by the desk ID scanner (parseAamva), if the license was read.
        sellerDob: idScan?.dob || undefined,
        sellerAddress: idScan?.address || undefined,
        sellerCity: idScan?.city || undefined,
        sellerState: idScan?.state || undefined,
        sellerZip: idScan?.zip || undefined,
        sellerStateOfIssue: idScan?.stateOfIssue || undefined,
        sellerIdPhotoUri: idPhoto || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        transportVin: vin.trim() || undefined,
        sellerAffirmed: needsCompliance ? affirmed : undefined,
        sellerNoTheftAffirmed: needsCompliance ? noTheft : undefined,
        lineItems,
      });
      // If this was a cashier finalizing a pending scale ticket, clear the draft
      // (links it to the receipt for audit).
      if (draft) {
        const rid = (receipt as { id?: string })?.id;
        if (rid) await finalizeDraftTicket(draft.id, rid).catch(() => {});
      }
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
        vin: vin.trim(),
        affirmed: needsCompliance ? affirmed : false,
        noTheft: needsCompliance ? noTheft : false,
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
      {camOpen && (
        <CameraCapture
          onCapture={(d) => {
            setIdPhoto(d);
            setCamOpen(false);
          }}
          onClose={() => setCamOpen(false)}
        />
      )}
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
                  vin: saved.vin || undefined,
                  materials: saved.materials,
                  weight: saved.weight,
                  paid: saved.total,
                  pay: saved.pay,
                  affirmed: saved.affirmed,
                  noTheftAffirmed: saved.noTheft,
                  dealerName: dealer.name || undefined,
                  dealerLicense: dealer.license || undefined,
                  dealerRegistry: dealer.registry || undefined,
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
                  <div style={{ position: 'relative' }}>
                    <input
                      value={seller}
                      onChange={(e) => {
                        setSeller(e.target.value);
                        setCustomerId(null);
                        setFlagged(null);
                      }}
                      onFocus={() => setSellerFocus(true)}
                      // Delay the blur so a click on a suggestion registers first.
                      onBlur={() =>
                        setTimeout(() => setSellerFocus(false), 150)
                      }
                      placeholder="Seller full name"
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
                    />
                    {sellerFocus && suggestions.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: 6,
                          zIndex: 30,
                          background: 'var(--surface)',
                          border: '1px solid var(--line)',
                          borderRadius: 11,
                          boxShadow: 'var(--shadow-lg)',
                          overflow: 'hidden',
                          maxHeight: 260,
                          overflowY: 'auto',
                        }}
                      >
                        {suggestions.map((c) => (
                          <button
                            key={c.id}
                            className="tap"
                            // preventDefault so the input doesn't blur before onClick.
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickCustomer(c)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 2,
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 14px',
                              borderBottom: '1px solid var(--line)',
                            }}
                          >
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 14,
                                fontWeight: 600,
                                color: 'var(--ink)',
                              }}
                            >
                              {c.name}
                              {c.is_flagged && (
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    letterSpacing: 0.4,
                                    textTransform: 'uppercase',
                                    color: '#fff',
                                    background: 'var(--rust)',
                                    borderRadius: 5,
                                    padding: '1px 5px',
                                  }}
                                >
                                  Flagged
                                </span>
                              )}
                            </span>
                            <span
                              className="mono"
                              style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
                            >
                              {c.drivers_license
                                ? `ID ${c.drivers_license}`
                                : 'No ID on file'}
                              {c.phone ? ` · ${c.phone}` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                {flagged && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background:
                        'color-mix(in oklab, var(--rust) 10%, var(--surface))',
                      border:
                        '1px solid color-mix(in oklab, var(--rust) 32%, var(--line))',
                    }}
                  >
                    <Icon
                      name="alert"
                      size={16}
                      color="var(--rust)"
                      stroke={2.2}
                    />
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      Flagged customer
                      {flagged.reason ? ` — ${flagged.reason}` : ''}
                    </span>
                  </div>
                )}
                <Field label="Driver license (regulated)">
                  <TextInput
                    value={dl}
                    onChange={setDl}
                    placeholder="DL number"
                    mono
                  />
                </Field>
                {/* ID scanner + webcam capture (desktop counter). The scanner
                    autofills name/DL/DOB/address; the photo backs up the record. */}
                {idScan ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '9px 12px',
                      borderRadius: 10,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent)',
                    }}
                  >
                    <Icon
                      name="check"
                      size={15}
                      color="var(--accent)"
                      stroke={2.4}
                    />
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      ID scanned
                      {idScan.dob ? ` · DOB ${idScan.dob}` : ''}
                      {idScan.stateOfIssue ? ` · ${idScan.stateOfIssue}` : ''}
                    </span>
                    <button
                      className="tap mono"
                      onClick={() => setIdScan(null)}
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        color: 'var(--ink-3)',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div
                    className="mono"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 11,
                      color: 'var(--ink-3)',
                    }}
                  >
                    <Icon
                      name="scan"
                      size={13}
                      color="var(--ink-3)"
                      stroke={1.8}
                    />
                    Scan the license barcode to autofill
                  </div>
                )}
                <button
                  className="tap"
                  onClick={() => setCamOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '11px 13px',
                    borderRadius: 11,
                    textAlign: 'left',
                    background: idPhoto
                      ? 'var(--accent-soft)'
                      : 'var(--surface)',
                    border: `1px solid ${idPhoto ? 'var(--accent)' : 'var(--line)'}`,
                  }}
                >
                  <Icon
                    name={idPhoto ? 'check' : 'scan'}
                    size={16}
                    color={idPhoto ? 'var(--accent)' : 'var(--ink-2)'}
                    stroke={2}
                  />
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                    {idPhoto
                      ? 'ID photo captured — retake'
                      : 'Capture ID photo'}
                  </span>
                  {idPhoto && (
                    <span
                      className="tap mono"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIdPhoto(null);
                      }}
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        color: 'var(--ink-3)',
                      }}
                    >
                      Remove
                    </span>
                  )}
                </button>
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
                {catNeedsVin && (
                  <Field label="Transport vehicle VIN (17 chars)">
                    <TextInput
                      value={vin}
                      onChange={(v) => setVin(v.toUpperCase())}
                      placeholder="17-character VIN"
                      mono
                    />
                  </Field>
                )}
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
                <button
                  className="tap"
                  onClick={() => setNoTheft((a) => !a)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '13px 14px',
                    borderRadius: 12,
                    textAlign: 'left',
                    background: noTheft
                      ? 'var(--accent-soft)'
                      : 'var(--surface)',
                    border: `1.5px solid ${noTheft ? 'var(--accent)' : 'var(--line)'}`,
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
                      background: noTheft ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${noTheft ? 'var(--accent)' : 'var(--line-strong)'}`,
                    }}
                  >
                    {noTheft && (
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
                    Seller attests they have not been convicted of metal theft.
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
            {/* Worker mode (no draft): offer "send to cashier" so a second
                person collects ID + payment. Single operators just hit
                "Complete & save" to pay out now. Cashier mode (finalizing a
                draft) shows only the payout button. */}
            {!draft && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <Btn
                  variant="ghost"
                  icon="truck"
                  full
                  disabled={!canSend}
                  onClick={() => sendToCashier(false)}
                >
                  Send to cashier
                </Btn>
                <Btn
                  variant="ghost"
                  icon="printer"
                  full
                  disabled={!canSend}
                  onClick={() => sendToCashier(true)}
                >
                  Send + print stub
                </Btn>
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
                {busy
                  ? 'Saving…'
                  : draft
                    ? 'Finalize & pay out'
                    : 'Complete & save'}
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
  // Sales ship what's on hand, so the picker is driven by inventory (not the
  // catalog): each row carries the on-hand weight and weighted-avg cost, which
  // becomes the sale's cost basis so profit is real (not revenue-as-profit).
  const { inventory } = useInventory();
  const stock = inventory as unknown as {
    metal_id: string;
    metal_name: string;
    weight: number;
    avg_cost_per_lb: number;
  }[];
  const onHandRows = stock.filter((r) => Number(r.weight) > 0);
  // Yards ship to the same handful of mills, so suggest past processors as the
  // buyer name is typed (derived client-side from prior sales — no lookup).
  const { sales } = useSales();
  const processors = useMemo(() => {
    const seen = new Map<string, string>();
    (sales as unknown as { buyer_name?: string }[]).forEach((s) => {
      const n = (s.buyer_name || '').trim();
      if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
    });
    return [...seen.values()];
  }, [sales]);
  const workerId = useAppSelector(
    (s: RootState) => s.auth.activeIdentity?.user_id ?? s.auth.profile?.id ?? ''
  );

  const [buyer, setBuyer] = useState('');
  const [buyerFocus, setBuyerFocus] = useState(false);
  const [metalId, setMetalId] = useState('');
  const [weight, setWeight] = useState(0);
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buyerSuggest =
    buyerFocus && buyer.trim().length >= 1
      ? processors
          .filter((p) => {
            const bl = buyer.trim().toLowerCase();
            return p.toLowerCase().includes(bl) && p.toLowerCase() !== bl;
          })
          .slice(0, 6)
      : [];
  const [saved, setSaved] = useState<{
    loadNo: string;
    total: number;
    weight: number;
    buyer: string;
    metal: string;
  } | null>(null);

  const inv = onHandRows.find((r) => r.metal_id === metalId) || null;
  const onHand = Number(inv?.weight ?? 0);
  const avgCost = Number(inv?.avg_cost_per_lb ?? 0);
  const total = weight * price;
  const profit = weight * (price - avgCost);
  // The inventory table has a non-negative CHECK, so the server rejects an
  // oversell — block it here with a clear message instead of a raw DB error.
  const oversell = !!inv && weight > onHand;
  const canSave = !!inv && weight > 0 && price > 0 && !oversell && !busy;

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
    if (!canSave || !inv) return;
    setBusy(true);
    setErr(null);
    try {
      const sale = await createSale({
        metalId: inv.metal_id,
        metalName: inv.metal_name,
        weight,
        salePricePerLb: price,
        costBasisPerLb: avgCost,
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
        metal: inv.metal_name,
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
              <div style={{ position: 'relative' }}>
                <input
                  value={buyer}
                  onChange={(e) => setBuyer(e.target.value)}
                  onFocus={() => setBuyerFocus(true)}
                  onBlur={() => setTimeout(() => setBuyerFocus(false), 150)}
                  placeholder="e.g. Western Copper Mills"
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
                />
                {buyerSuggest.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 6,
                      zIndex: 30,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 11,
                      boxShadow: 'var(--shadow-lg)',
                      overflow: 'hidden',
                    }}
                  >
                    {buyerSuggest.map((p) => (
                      <button
                        key={p}
                        className="tap"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setBuyer(p);
                          setBuyerFocus(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--line)',
                          fontSize: 14,
                          fontWeight: 550,
                          color: 'var(--ink)',
                        }}
                      >
                        <Icon
                          name="truck"
                          size={14}
                          color="var(--teal)"
                          stroke={2}
                        />
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field label="Material (on hand)">
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
                <option value="">
                  {onHandRows.length ? 'Select a metal…' : 'Nothing on hand'}
                </option>
                {onHandRows.map((r) => (
                  <option key={r.metal_id} value={r.metal_id}>
                    {r.metal_name} — {lbs(r.weight)} lb on hand
                  </option>
                ))}
              </select>
            </Field>
            {inv && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginTop: -6,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
                >
                  On hand {lbs(onHand)} lb · avg cost {money(avgCost)}/lb
                </span>
                {oversell && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--rust)',
                    }}
                  >
                    Exceeds on hand
                  </span>
                )}
              </div>
            )}
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
              {inv && weight > 0 && price > 0 && (
                <div
                  className="mono num"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    marginTop: 6,
                    color: profit >= 0 ? 'var(--moss)' : 'var(--rust)',
                  }}
                >
                  Est. profit {money(profit)} · cost {money(avgCost)}/lb
                </div>
              )}
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
