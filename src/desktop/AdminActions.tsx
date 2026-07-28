import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { useAppSelector, type RootState } from '../store';
import { elevateAdmin } from '../services/admin';
import { createMetal, updateMetal, logPriceChange } from '../services/metals';
import {
  updateCompanySettings,
  uploadCompanyLogo,
} from '../services/companySettings';
import {
  getJurisdiction,
  supportedStateCodes,
} from '../compliance/jurisdictions';
import Icon from './Icon';
import { Btn, Field, TextInput, money } from './ui';

// Desktop admin actions that need a fresh admin-PIN elevation window (server
// gates the writes on has_admin_elevation). Mirrors the mobile
// useAdminElevation()+service pattern, but with DOM modals for the desktop tree.

interface EditTarget {
  id: string;
  name: string;
  price_per_lb: number;
  pricing_unit?: 'lb' | 'each';
  is_regulated?: boolean;
  is_restricted?: boolean;
  is_catalytic?: boolean;
}

// Compliance tier of a metal, derived from its booleans (strictest wins).
// Catalytic is intrinsic (set on the material type, not operator-editable here);
// operators pick between the three below.
type MetalTier = 'open' | 'regulated' | 'restricted' | 'catalytic';
const SELECTABLE_TIERS: MetalTier[] = ['open', 'regulated', 'restricted'];
const tierOfFlags = (m: {
  is_regulated?: boolean;
  is_restricted?: boolean;
  is_catalytic?: boolean;
}): MetalTier =>
  m.is_catalytic
    ? 'catalytic'
    : m.is_restricted
      ? 'restricted'
      : m.is_regulated
        ? 'regulated'
        : 'open';
// Restricted material is ALSO regulated, so set BOTH flags — the mobile fix for
// #21 dropped is_regulated on the 'regulated' tier, so it never persisted.
const tierToFlags = (t: MetalTier) => ({
  is_regulated: t === 'regulated' || t === 'restricted',
  is_restricted: t === 'restricted',
});
const TIER_LABEL: Record<MetalTier, string> = {
  open: 'Open',
  regulated: 'Regulated',
  restricted: 'Restricted',
  catalytic: 'Catalytic',
};
const TIER_HINT: Record<MetalTier, string> = {
  open: 'No documentation required.',
  regulated: 'Seller ID, vehicle & ownership affirmation.',
  restricted: 'Adds written proof of ownership.',
  catalytic: 'Intrinsic — set on the material type.',
};

// Open / Regulated / Restricted picker shared by the add + edit material modals.
// Catalytic material is locked (statutory, tied to the material type) and shown
// read-only rather than as a fourth button.
function TierSelect({
  tier,
  onChange,
}: {
  tier: MetalTier;
  onChange: (t: MetalTier) => void;
}) {
  if (tier === 'catalytic') {
    return (
      <Field label="Compliance tier">
        <div
          className="mono"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            fontSize: 12.5,
            color: 'var(--ink-2)',
          }}
        >
          Catalytic · {TIER_HINT.catalytic}
        </div>
      </Field>
    );
  }
  return (
    <Field label="Compliance tier">
      <div style={{ display: 'flex', gap: 8 }}>
        {SELECTABLE_TIERS.map((tr) => {
          const on = tier === tr;
          return (
            <button
              key={tr}
              type="button"
              className="tap focusring"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(tr)}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: on ? 'var(--accent)' : 'var(--ink-2)',
                border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`,
              }}
            >
              {TIER_LABEL[tr]}
            </button>
          );
        })}
      </div>
      <div
        className="mono"
        style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6 }}
      >
        {TIER_HINT[tier]}
      </div>
    </Field>
  );
}

export interface CompanyEdit {
  company_name: string;
  phone: string;
  address: string;
  state: string;
  license_number: string;
  ein: string;
  registry_id: string;
  // Per-company compliance overrides (defaults seeded from the jurisdiction).
  general_hold_hours: number;
  cat_converter_hold_days: number;
  cat_converter_check_only: boolean;
  general_retention_years: number;
  cat_converter_retention_years: number;
  timezone: string;
  // Company logo — shown/uploaded in the profile modal. The company_settings row
  // id is needed for the storage upload; both are read-only passthroughs (the
  // form save builds its update object explicitly and ignores them).
  logo_url?: string | null;
  settings_id?: string;
}

export interface DeskAdmin {
  addMaterial: () => void;
  editPrice: (metal: EditTarget) => void;
  editCompany: (current: CompanyEdit) => void;
  // Open an admin-elevation window (prompts for the PIN if none is active).
  ensureElevated: (requireOwner?: boolean) => Promise<boolean>;
}

const Ctx = createContext<DeskAdmin | null>(null);

export function useDeskAdmin(): DeskAdmin {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDeskAdmin outside provider');
  return c;
}

// ── centered modal shell ─────────────────────────────────────────────────────
function Modal({
  title,
  sub,
  icon,
  onClose,
  children,
  zIndex = 120,
  width = 380,
}: {
  title: string;
  sub?: string;
  icon: 'lock' | 'plus' | 'edit' | 'building';
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  width?: number;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10,8,4,0.5)',
          animation: 'ylScrim .2s ease forwards',
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width,
          maxWidth: '92vw',
          // Cap the height and let the body scroll — a tall form (e.g. the full
          // company-profile editor) was overflowing the viewport with no scroll.
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          animation: 'ylPop .22s cubic-bezier(.2,.8,.2,1) forwards',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: 'var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name={icon} size={19} color="var(--accent)" stroke={1.9} />
          </div>
          <div>
            <div
              className="exp"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: -0.3,
              }}
            >
              {title}
            </div>
            {sub && (
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}
              >
                {sub}
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── admin PIN prompt ─────────────────────────────────────────────────────────
function ElevateModal({
  requireOwner,
  onCancel,
  onSuccess,
}: {
  requireOwner: boolean;
  onCancel: () => void;
  onSuccess: (expiry: number) => void;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const expiry = await elevateAdmin(pin, requireOwner);
      onSuccess(expiry);
    } catch (e) {
      setErr((e as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Admin passcode"
      sub="Required to change pricing & materials"
      icon="lock"
      onClose={onCancel}
      zIndex={140}
    >
      <Field label="Enter your admin PIN">
        <input
          type="password"
          inputMode="numeric"
          // This is a transient admin PIN, not a saved credential — tell the
          // password managers not to offer to save/update it (#101).
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          autoFocus
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, '').slice(0, 8))
          }
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="••••"
          className="mono num"
          style={{
            width: '100%',
            height: 48,
            padding: '0 14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 11,
            color: 'var(--ink)',
            fontSize: 22,
            letterSpacing: 6,
            textAlign: 'center',
            outline: 'none',
          }}
        />
      </Field>
      {err && (
        <div
          className="mono"
          style={{ fontSize: 12, color: 'var(--rust)', marginTop: 10 }}
        >
          {err}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          full
          disabled={pin.length < 4 || busy}
          onClick={submit}
        >
          {busy ? 'Verifying…' : 'Unlock'}
        </Btn>
      </div>
    </Modal>
  );
}

// ── add material ─────────────────────────────────────────────────────────────
function AddMaterialModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (
    name: string,
    price: number,
    unit: 'lb' | 'each',
    tier: MetalTier
  ) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<'lb' | 'each'>('lb');
  const [tier, setTier] = useState<MetalTier>('open');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = parseFloat(price);
  const ok = !!name.trim() && p > 0 && !busy;

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(name.trim(), p, unit, tier);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      // Always clear busy — onSave returns without throwing when the operator
      // cancels the PIN prompt, which otherwise left the button stuck on "Saving…".
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add material"
      sub="New metal & buying price"
      icon="plus"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Material name">
          <TextInput
            value={name}
            onChange={setName}
            placeholder="e.g. Bare Bright Copper"
          />
        </Field>
        <Field label="Priced by">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['lb', 'each'] as const).map((u) => {
              const on = unit === u;
              return (
                <button
                  key={u}
                  type="button"
                  className="tap focusring"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setUnit(u)}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                    color: on ? 'var(--accent)' : 'var(--ink-2)',
                    border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`,
                  }}
                >
                  {u === 'lb' ? 'Weight (per lb)' : 'Piece (per each)'}
                </button>
              );
            })}
          </div>
        </Field>
        <Field
          label={
            unit === 'lb' ? 'Buying price ($/lb)' : 'Buying price ($/piece)'
          }
        >
          <TextInput
            value={price}
            onChange={setPrice}
            placeholder="0.00"
            prefix="$"
            mono
            align="right"
          />
        </Field>
        <TierSelect tier={tier} onChange={setTier} />
      </div>
      {err && (
        <div
          className="mono"
          style={{ fontSize: 12, color: 'var(--rust)', marginTop: 10 }}
        >
          {err}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" icon="check" full disabled={!ok} onClick={save}>
          {busy ? 'Saving…' : 'Add material'}
        </Btn>
      </div>
    </Modal>
  );
}

// ── edit price ───────────────────────────────────────────────────────────────
function EditPriceModal({
  metal,
  onClose,
  onSave,
}: {
  metal: EditTarget;
  onClose: () => void;
  onSave: (
    price: number,
    unit: 'lb' | 'each',
    tier: MetalTier
  ) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(metal.price_per_lb));
  const [unit, setUnit] = useState<'lb' | 'each'>(
    metal.pricing_unit === 'each' ? 'each' : 'lb'
  );
  const startTier = tierOfFlags(metal);
  const [tier, setTier] = useState<MetalTier>(startTier);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = parseFloat(price);
  const startUnit = metal.pricing_unit === 'each' ? 'each' : 'lb';
  const changed =
    p !== metal.price_per_lb || unit !== startUnit || tier !== startTier;
  const ok = p > 0 && changed && !busy;

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(p, unit, tier);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      // Clear busy even when the PIN prompt is cancelled (onSave returns
      // without throwing) — otherwise the button sticks on "Saving…".
      setBusy(false);
    }
  };

  return (
    <Modal
      title={metal.name}
      sub={`Current ${money(metal.price_per_lb)}/${startUnit === 'each' ? 'pc' : 'lb'}`}
      icon="edit"
      onClose={onClose}
    >
      <Field label="Priced by">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['lb', 'each'] as const).map((u) => {
            const on = unit === u;
            return (
              <button
                key={u}
                type="button"
                className="tap focusring"
                role="tab"
                aria-selected={on}
                onClick={() => setUnit(u)}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: on ? 'var(--accent)' : 'var(--ink-2)',
                  border: `1px solid ${on ? 'var(--accent-line)' : 'var(--line)'}`,
                }}
              >
                {u === 'lb' ? 'Weight (per lb)' : 'Piece (per each)'}
              </button>
            );
          })}
        </div>
      </Field>
      <Field
        label={
          unit === 'lb'
            ? 'New buying price ($/lb)'
            : 'New buying price ($/piece)'
        }
      >
        <TextInput
          value={price}
          onChange={setPrice}
          placeholder="0.00"
          prefix="$"
          mono
          align="right"
        />
      </Field>
      <div style={{ marginTop: 12 }}>
        <TierSelect tier={tier} onChange={setTier} />
      </div>
      {err && (
        <div
          className="mono"
          style={{ fontSize: 12, color: 'var(--rust)', marginTop: 10 }}
        >
          {err}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" icon="check" full disabled={!ok} onClick={save}>
          {busy ? 'Saving…' : 'Update price'}
        </Btn>
      </div>
    </Modal>
  );
}

// ── edit company profile ─────────────────────────────────────────────────────
function EditCompanyModal({
  current,
  userId,
  onClose,
  onSave,
  onLogoSaved,
}: {
  current: CompanyEdit;
  userId: string;
  onClose: () => void;
  onSave: (updates: CompanyEdit) => Promise<void>;
  onLogoSaved: () => void;
}) {
  const [name, setName] = useState(current.company_name);
  const [phone, setPhone] = useState(current.phone);
  const [address, setAddress] = useState(current.address);
  const [state, setState] = useState(current.state || 'NM');
  const [license, setLicense] = useState(current.license_number);
  const [ein, setEin] = useState(current.ein);
  const [registry, setRegistry] = useState(current.registry_id);
  // Compliance overrides — kept as strings for the inputs, parsed on save.
  const [holdHours, setHoldHours] = useState(
    String(current.general_hold_hours)
  );
  const [catDays, setCatDays] = useState(
    String(current.cat_converter_hold_days)
  );
  const [checkOnly, setCheckOnly] = useState(current.cat_converter_check_only);
  const [retGeneral, setRetGeneral] = useState(
    String(current.general_retention_years)
  );
  const [retCat, setRetCat] = useState(
    String(current.cat_converter_retention_years)
  );
  const [timezone, setTimezone] = useState(current.timezone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = !!name.trim() && !busy;

  // Company logo. Uploaded immediately on pick (like mobile) — the browser file
  // picker hands back a data: URL, which uploadCompanyLogo → readImageBytes now
  // decodes for web (the #104 fix); persists to company_settings + storage.
  const [logoUrl, setLogoUrl] = useState<string | null>(current.logo_url ?? '');
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pickLogo = () => fileRef.current?.click();
  const onLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!current.settings_id) {
      setErr('Save the company profile once before adding a logo.');
      return;
    }
    setLogoBusy(true);
    setErr(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const url = await uploadCompanyLogo(dataUrl, userId, current.settings_id);
      setLogoUrl(url);
      onLogoSaved();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setLogoBusy(false);
    }
  };

  const jur = getJurisdiction(state);
  // Fill the rule numbers from the selected state's statutory defaults, so an
  // operator picking a jurisdiction gets correct presets they can then tweak.
  const applyDefaults = () => {
    setHoldHours(String(jur.holdDefaults.generalHours));
    setCatDays(String(jur.holdDefaults.catConverterDays));
    setCheckOnly(jur.catConverterCheckOnly);
  };

  // Whole non-negative number or fall back to the jurisdiction default.
  const num = (s: string, fallback: number) => {
    const n = Math.round(Number(s));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        company_name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        state: state.trim().toUpperCase(),
        license_number: license.trim(),
        ein: ein.trim(),
        registry_id: registry.trim(),
        general_hold_hours: num(holdHours, jur.holdDefaults.generalHours),
        cat_converter_hold_days: num(
          catDays,
          jur.holdDefaults.catConverterDays
        ),
        cat_converter_check_only: checkOnly,
        general_retention_years: num(retGeneral, 3),
        cat_converter_retention_years: num(retCat, 3),
        timezone: timezone.trim(),
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      // Clear busy even when the PIN prompt is cancelled (onSave returns
      // without throwing) — otherwise the button sticks on "Saving…".
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Company profile"
      sub="Owner only"
      icon="building"
      onClose={onClose}
      width={620}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* logo — click the tile to pick a file; uploads immediately (#104) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onLogoFile}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="tap focusring"
            onClick={pickLogo}
            aria-label="Change company logo"
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              flexShrink: 0,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {logoBusy ? (
              <span
                className="mono"
                style={{ fontSize: 10, color: 'var(--ink-3)' }}
              >
                …
              </span>
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt="Company logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Icon
                name="building"
                size={26}
                color="var(--ink-3)"
                stroke={1.8}
              />
            )}
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Company logo
            </div>
            <button
              type="button"
              onClick={pickLogo}
              className="tap"
              style={{
                marginTop: 3,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              {logoUrl ? 'Change logo' : 'Upload logo'}
            </button>
            <div
              className="mono"
              style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}
            >
              Shown on printed records. Square image works best.
            </div>
          </div>
        </div>
        <Field label="Company name">
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Company name"
          />
        </Field>
        <Field label="Address">
          <TextInput
            value={address}
            onChange={setAddress}
            placeholder="Street, city, ZIP"
          />
        </Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Phone">
              <TextInput
                value={phone}
                onChange={setPhone}
                placeholder="(555) 000-0000"
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="EIN">
              <TextInput
                value={ein}
                onChange={setEin}
                placeholder="Tax ID"
                mono
              />
            </Field>
          </div>
        </div>
        <Field label="Operating state">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={{
              width: '100%',
              height: 42,
              padding: '0 12px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              color: 'var(--ink)',
              fontSize: 14,
              fontWeight: 550,
              outline: 'none',
            }}
          >
            {supportedStateCodes().map((c) => (
              <option key={c} value={c}>
                {getJurisdiction(c).copy.stateName} ({c})
              </option>
            ))}
          </select>
          <div
            className="mono"
            style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 5 }}
          >
            {jur.copy.act} · reports to {jur.copy.registry}. Only states with
            built-in rules are listed.
          </div>
        </Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="License / registration #">
              <TextInput
                value={license}
                onChange={setLicense}
                placeholder="Dealer license #"
                mono
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label={jur.copy.registrationLabel}>
              <TextInput
                value={registry}
                onChange={setRegistry}
                placeholder={`${jur.copy.registry} / state registry ID`}
                mono
              />
            </Field>
          </div>
        </div>

        {/* compliance rule overrides — presets come from the jurisdiction */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 4,
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Compliance rules
          </span>
          <Btn variant="ghost" size="sm" icon="reload" onClick={applyDefaults}>
            Use {state} defaults
          </Btn>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="General hold (hours)">
              <TextInput value={holdHours} onChange={setHoldHours} mono />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Converter hold (days)">
              <TextInput value={catDays} onChange={setCatDays} mono />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="Record retention (years)">
              <TextInput value={retGeneral} onChange={setRetGeneral} mono />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Converter retention (years)">
              <TextInput value={retCat} onChange={setRetCat} mono />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Converter payment">
              <div style={{ display: 'flex', gap: 8 }} role="tablist">
                {(
                  [
                    [true, 'Check only'],
                    [false, 'Any method'],
                  ] as [boolean, string][]
                ).map(([val, lbl]) => {
                  const on = checkOnly === val;
                  return (
                    <button
                      key={lbl}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setCheckOnly(val)}
                      style={{
                        flex: 1,
                        padding: '9px 0',
                        borderRadius: 9,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: on ? 'var(--ink)' : 'var(--surface-2)',
                        color: on ? 'var(--bg)' : 'var(--ink-2)',
                        border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                      }}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Time zone (IANA)">
              <TextInput
                value={timezone}
                onChange={setTimezone}
                placeholder="America/Denver"
                mono
              />
            </Field>
          </div>
        </div>
      </div>
      {err && (
        <div
          className="mono"
          style={{ fontSize: 12, color: 'var(--rust)', marginTop: 10 }}
        >
          {err}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" icon="check" full disabled={!ok} onClick={save}>
          {busy ? 'Saving…' : 'Save profile'}
        </Btn>
      </div>
    </Modal>
  );
}

// ── provider ─────────────────────────────────────────────────────────────────
export function DeskAdminProvider({
  onChanged,
  children,
}: {
  onChanged: () => void;
  children: ReactNode;
}) {
  const userId = useAppSelector(
    (s: RootState) => s.auth.activeIdentity?.user_id ?? s.auth.profile?.id ?? ''
  );
  const expiryRef = useRef(0);
  const [elevate, setElevate] = useState<null | {
    resolve: (ok: boolean) => void;
    requireOwner: boolean;
  }>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [company, setCompany] = useState<CompanyEdit | null>(null);

  // Resolve immediately if a window is still open; else prompt for the PIN.
  // An owner-required action always re-prompts (a cached window may be admin).
  const ensureElevated = useCallback(
    (requireOwner = false): Promise<boolean> => {
      if (!requireOwner && Date.now() < expiryRef.current - 2000)
        return Promise.resolve(true);
      return new Promise<boolean>((resolve) =>
        setElevate({ resolve, requireOwner })
      );
    },
    []
  );

  const addMaterial = useCallback(() => setAdding(true), []);
  const editPrice = useCallback((metal: EditTarget) => setEditing(metal), []);
  const editCompany = useCallback(
    (current: CompanyEdit) => setCompany(current),
    []
  );

  return (
    <Ctx.Provider
      value={{ addMaterial, editPrice, editCompany, ensureElevated }}
    >
      {children}

      {elevate && (
        <ElevateModal
          requireOwner={elevate.requireOwner}
          onCancel={() => {
            elevate.resolve(false);
            setElevate(null);
          }}
          onSuccess={(expiry) => {
            expiryRef.current = expiry;
            elevate.resolve(true);
            setElevate(null);
          }}
        />
      )}

      {adding && (
        <AddMaterialModal
          onClose={() => setAdding(false)}
          onSave={async (name, price, unit, tier) => {
            if (!(await ensureElevated())) return;
            const created = await createMetal(name, price, undefined, unit);
            // createMetal only sets name/price/unit; persist the compliance tier
            // in a follow-up update when it's not the default 'open'.
            if (tier !== 'open' && created?.id) {
              await updateMetal(created.id, tierToFlags(tier), userId);
            }
            setAdding(false);
            onChanged();
          }}
        />
      )}

      {editing && (
        <EditPriceModal
          metal={editing}
          onClose={() => setEditing(null)}
          onSave={async (price, unit, tier) => {
            if (!(await ensureElevated())) return;
            // Persist BOTH compliance flags from the tier (restricted implies
            // regulated) alongside price/unit — dropping is_regulated was the
            // original #21 bug where the Regulated tier never saved.
            const flags =
              editing.is_catalytic || tier === 'catalytic'
                ? {}
                : tierToFlags(tier);
            await updateMetal(
              editing.id,
              { price_per_lb: price, pricing_unit: unit, ...flags },
              userId
            );
            // Only log a price-history row when the price actually changed (a
            // unit-only switch isn't a price change).
            if (price !== editing.price_per_lb) {
              await logPriceChange(
                editing.id,
                editing.price_per_lb,
                price,
                userId
              ).catch(() => {});
            }
            setEditing(null);
            onChanged();
          }}
        />
      )}

      {company && (
        <EditCompanyModal
          current={company}
          userId={userId}
          onClose={() => setCompany(null)}
          onLogoSaved={onChanged}
          onSave={async (updates) => {
            if (!(await ensureElevated(true))) return;
            await updateCompanySettings(updates, userId);
            setCompany(null);
            onChanged();
          }}
        />
      )}
    </Ctx.Provider>
  );
}
