import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAppSelector, type RootState } from '../store';
import { elevateAdmin } from '../services/admin';
import {
  createMetal,
  updateMetalPrice,
  logPriceChange,
} from '../services/metals';
import { updateCompanySettings } from '../services/companySettings';
import Icon from './Icon';
import { Btn, Field, TextInput, money } from './ui';

// Desktop admin actions that need a fresh admin-PIN elevation window (server
// gates the writes on has_admin_elevation). Mirrors the mobile
// useAdminElevation()+service pattern, but with DOM modals for the desktop tree.

interface EditTarget {
  id: string;
  name: string;
  price_per_lb: number;
}

export interface CompanyEdit {
  company_name: string;
  phone: string;
  address: string;
  state: string;
}

interface DeskAdmin {
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
}: {
  title: string;
  sub?: string;
  icon: 'lock' | 'plus' | 'edit' | 'building';
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
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
          width: 380,
          maxWidth: '92vw',
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
  onSave: (name: string, price: number) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = parseFloat(price);
  const ok = !!name.trim() && p > 0 && !busy;

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(name.trim(), p);
    } catch (e) {
      setErr((e as Error).message);
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
        <Field label="Buying price ($/lb)">
          <TextInput
            value={price}
            onChange={setPrice}
            placeholder="0.00"
            prefix="$"
            mono
            align="right"
          />
        </Field>
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
  onSave: (price: number) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(metal.price_per_lb));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = parseFloat(price);
  const ok = p > 0 && p !== metal.price_per_lb && !busy;

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(p);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={metal.name}
      sub={`Current ${money(metal.price_per_lb)}/lb`}
      icon="edit"
      onClose={onClose}
    >
      <Field label="New buying price ($/lb)">
        <TextInput
          value={price}
          onChange={setPrice}
          placeholder="0.00"
          prefix="$"
          mono
          align="right"
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
  onClose,
  onSave,
}: {
  current: CompanyEdit;
  onClose: () => void;
  onSave: (updates: CompanyEdit) => Promise<void>;
}) {
  const [name, setName] = useState(current.company_name);
  const [phone, setPhone] = useState(current.phone);
  const [address, setAddress] = useState(current.address);
  const [state, setState] = useState(current.state);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = !!name.trim() && !busy;

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
      });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Company profile"
      sub="Owner only"
      icon="building"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Company name">
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Company name"
          />
        </Field>
        <Field label="Phone">
          <TextInput
            value={phone}
            onChange={setPhone}
            placeholder="(555) 000-0000"
          />
        </Field>
        <Field label="Address">
          <TextInput
            value={address}
            onChange={setAddress}
            placeholder="Street, city, ZIP"
          />
        </Field>
        <Field label="Operating state">
          <TextInput value={state} onChange={setState} placeholder="NM" />
        </Field>
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
          onSave={async (name, price) => {
            if (!(await ensureElevated())) return;
            await createMetal(name, price);
            setAdding(false);
            onChanged();
          }}
        />
      )}

      {editing && (
        <EditPriceModal
          metal={editing}
          onClose={() => setEditing(null)}
          onSave={async (price) => {
            if (!(await ensureElevated())) return;
            await updateMetalPrice(editing.id, price, userId);
            await logPriceChange(
              editing.id,
              editing.price_per_lb,
              price,
              userId
            ).catch(() => {});
            setEditing(null);
            onChanged();
          }}
        />
      )}

      {company && (
        <EditCompanyModal
          current={company}
          onClose={() => setCompany(null)}
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
