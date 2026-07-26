import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useCurrentCompany } from '../../hooks';
import { useMetals } from '../../hooks/useMetals';
import { useRole } from '../../hooks/useRole';
import { useDeskAdmin, type DeskAdmin } from '../AdminActions';
import {
  fetchCompanySettings,
  type CompanySettings,
} from '../../services/companySettings';
import {
  listInviteCodes,
  createInviteCode,
  deleteInviteCode,
  type InviteCode,
} from '../../services/inviteCodes';
import type { Metal, UserRole } from '../../types';
import Icon from '../Icon';
import {
  Card,
  PanelHead,
  Table,
  TR,
  Pill,
  Btn,
  Field,
  TareMark,
  EmptyState,
  SkeletonRows,
  money,
  toneColor,
  tierTone,
  type Col,
} from '../ui';

// NM-locked compliance preset. In production these derive from
// company_settings (per-company state rules); this build ships New Mexico.
const NM_RULES = {
  state: 'New Mexico',
  // NM's Sale of Recycled Metals Act imposes a single 24-hour hold on all
  // regulated material — there is NO separate longer catalytic hold. (Both
  // holds are 1 day.) Catalytic converters DO require check payment and a
  // 3-year record retention (see §57-30-2.4); those are correct elsewhere.
  holdGeneral: 1,
  holdCatalytic: 1,
  retainGeneral: 1,
  act: 'NM Sale of Recycled Metals Act',
  registry: 'LeadsOnline',
  checkOnlyCat: true,
};

// Tier from metal compliance flags: catalytic > restricted > regulated > open.
function metalTier(m: Metal): string {
  if (m.is_catalytic) return 'catalytic';
  if (m.is_restricted) return 'restricted';
  if (m.is_regulated) return 'regulated';
  return 'open';
}

function InfoRow({
  k,
  v,
  mono = true,
}: {
  k: ReactNode;
  v: ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{k}</span>
      <span
        className={mono ? 'mono num' : ''}
        style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}
      >
        {v}
      </span>
    </div>
  );
}

function RuleStat({
  n,
  label,
  unit,
  tone,
}: {
  n: ReactNode;
  label: string;
  unit: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: '14px 16px',
        background: 'var(--surface-2)',
        borderRadius: 12,
        border: '1px solid var(--line)',
      }}
    >
      <div
        className="exp num"
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: tone || 'var(--ink)',
          letterSpacing: -0.5,
        }}
      >
        {n}
        <span
          className="mono"
          style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}
        >
          {' '}
          {unit}
        </span>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Invite generation — admins invite admins/workers, owners can also invite
// owners. Server enforces the matrix via create_invite_code (has_admin_elevation
// / owner-grade); this UI gates the affordance + runs the desktop PIN window
// through admin.ensureElevated before the write. The code is what a new hire
// enters on the sign-up screen.
const ROLE_LABEL: Record<UserRole, string> = {
  worker: 'Worker · create receipts & sales',
  admin: 'Admin · pricing, invites & staff',
  owner: 'Owner · full access',
};

function TeamAccess({
  admin,
  isOwner,
}: {
  admin: DeskAdmin;
  isOwner: boolean;
}) {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [role, setRole] = useState<UserRole>('worker');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCodes(await listInviteCodes());
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const roles: UserRole[] = isOwner
    ? ['worker', 'admin', 'owner']
    : ['worker', 'admin'];

  const generate = async () => {
    setErr(null);
    setCreated(null);
    // Inviting an owner is owner-grade; admin grade covers admin/worker.
    if (!(await admin.ensureElevated(role === 'owner'))) return;
    setBusy(true);
    try {
      const code = await createInviteCode(role);
      setCreated(code);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setErr(null);
    if (!(await admin.ensureElevated())) return;
    try {
      await deleteInviteCode(id);
      setCodes((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
  };

  const pending = codes.filter((c) => !c.is_used);

  return (
    <Card>
      <PanelHead
        title="Team & access"
        sub="Invite staff · each signs in with their own PIN"
        icon="user"
      />

      {/* generator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <Field label="Invite a teammate">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              style={{
                width: '100%',
                height: 44,
                padding: '0 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 11,
                color: 'var(--ink)',
                fontSize: 14.5,
                fontWeight: 600,
                outline: 'none',
              }}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Btn variant="primary" icon="plus" onClick={generate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate code'}
        </Btn>
      </div>

      {err && (
        <div
          className="mono"
          style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 12 }}
        >
          {err}
        </div>
      )}

      {/* freshly minted code, highlighted for sharing */}
      {created && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            marginBottom: 14,
            background: 'var(--accent-soft)',
            border:
              '1px solid color-mix(in oklab, var(--accent) 30%, transparent)',
            borderRadius: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              New invite code
            </div>
            <div
              className="mono num"
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 4,
                color: 'var(--ink)',
                marginTop: 2,
              }}
            >
              {created}
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}
            >
              Share it — they enter this on the sign-up screen.
            </div>
          </div>
          <Btn
            variant="subtle"
            size="sm"
            icon={copied === created ? 'check' : 'sign'}
            onClick={() => copy(created)}
          >
            {copied === created ? 'Copied' : 'Copy'}
          </Btn>
        </div>
      )}

      {/* pending (unused) invites */}
      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Pending invites · {pending.length}
          </div>
          {pending.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 11,
              }}
            >
              <span
                className="mono num"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: 'var(--ink)',
                }}
              >
                {c.code}
              </span>
              <Pill tone={c.role === 'owner' ? 'var(--gold)' : 'var(--ink-2)'}>
                {c.role}
              </Pill>
              <div style={{ flex: 1 }} />
              <Btn
                variant="ghost"
                size="sm"
                icon={copied === c.code ? 'check' : 'sign'}
                onClick={() => copy(c.code)}
              >
                {copied === c.code ? 'Copied' : 'Copy'}
              </Btn>
              <Btn
                variant="ghost"
                size="sm"
                icon="del"
                onClick={() => revoke(c.id)}
              >
                Revoke
              </Btn>
            </div>
          ))}
        </div>
      )}

      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--ink-3)',
          marginTop: pending.length > 0 ? 14 : 4,
          lineHeight: 1.5,
        }}
      >
        Codes are single-use and set the new hire’s role. Staff PINs are set on
        first sign-in.
      </div>
    </Card>
  );
}

export default function Settings({ canManage }: { canManage: boolean }) {
  const company = useCurrentCompany();
  const {
    metals,
    loading: metalsLoading,
    error: metalsError,
    refresh: refreshMetals,
  } = useMetals();
  const { isOwner } = useRole();
  const admin = useDeskAdmin();
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    let active = true;
    fetchCompanySettings().then((s) => {
      if (active) setSettings(s);
    });
    return () => {
      active = false;
    };
  }, []);

  // Real state rules from company_settings, falling back to NM defaults so the
  // card never looks broken while loading or when no row exists yet.
  const state = settings?.state || NM_RULES.state;
  const holdGeneralDays = settings
    ? Math.round((settings.general_hold_hours ?? 24) / 24)
    : NM_RULES.holdGeneral;
  const holdCatalytic =
    settings?.cat_converter_hold_days ?? NM_RULES.holdCatalytic;
  const retainGeneral =
    settings?.general_retention_years ?? NM_RULES.retainGeneral;
  const checkOnlyCat = settings
    ? settings.cat_converter_check_only
    : NM_RULES.checkOnlyCat;

  const matCols: Col[] = [
    { key: 'name', label: 'Material', w: '2fr' },
    { key: 'tier', label: 'Tier', w: '1fr' },
    { key: 'price', label: 'Default price', w: '1fr', align: 'right' },
  ];

  return (
    <div
      className="stagger in"
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.15fr)',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* business profile */}
        <Card>
          <PanelHead
            title="Business profile"
            sub="Identity & license"
            icon="building"
            right={
              canManage && (
                <Btn
                  variant="subtle"
                  size="sm"
                  icon="edit"
                  onClick={() =>
                    admin.editCompany({
                      company_name:
                        settings?.company_name ?? company?.name ?? '',
                      phone: settings?.phone ?? '',
                      address: settings?.address ?? '',
                      state: settings?.state ?? 'NM',
                      license_number: settings?.license_number ?? '',
                      ein: settings?.ein ?? '',
                      registry_id: settings?.registry_id ?? '',
                    })
                  }
                >
                  Edit
                </Btn>
              )
            }
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '4px 0 16px',
            }}
          >
            <TareMark size={52} radius={14} />
            <div>
              <div
                className="exp"
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: -0.4,
                }}
              >
                {company?.name || '—'}
              </div>
              <div
                className="mono"
                style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}
              >
                {company?.prefix || '—'}
              </div>
            </div>
          </div>
          <InfoRow k="Prefix" v={company?.prefix || '—'} />
          <InfoRow k="License" v={settings?.license_number || '—'} />
          <InfoRow k="Registry ID" v={settings?.registry_id || '—'} />
          <InfoRow k="EIN" v={settings?.ein || '—'} />
          <InfoRow k="Phone" v={settings?.phone || '—'} />
          <InfoRow k="Address" v={settings?.address || '—'} />
        </Card>

        {/* state rules */}
        <Card>
          <PanelHead
            title="State rules"
            sub="Compliance presets"
            icon="shield"
            tone="var(--gold)"
            right={
              <Pill tone="var(--moss)" icon="check">
                Active
              </Pill>
            }
          />
          <Field label="Operating state">
            <select
              value={state}
              disabled
              style={{
                width: '100%',
                height: 44,
                padding: '0 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 11,
                color: 'var(--ink)',
                fontSize: 14.5,
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option>{state}</option>
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <RuleStat
              n={holdGeneralDays}
              unit={holdGeneralDays === 1 ? 'day' : 'days'}
              label="General hold"
            />
            <RuleStat
              n={holdCatalytic}
              unit="days"
              label="Catalytic hold"
              tone="var(--gold)"
            />
            <RuleStat n={retainGeneral} unit="yr" label="Retain records" />
          </div>
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            <InfoRow k="Governing act" v={NM_RULES.act} mono={false} />
            <InfoRow
              k="Reporting registry"
              v={NM_RULES.registry}
              mono={false}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0 0',
              }}
            >
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                Catalytic = check only
              </span>
              <Pill
                tone={checkOnlyCat ? 'var(--rust)' : 'var(--ink-3)'}
                icon={checkOnlyCat ? 'check' : 'x'}
              >
                {checkOnlyCat ? 'Enforced' : 'Off'}
              </Pill>
            </div>
          </div>
        </Card>
      </div>

      {/* materials table */}
      <Card pad={0}>
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PanelHead
            title="Materials"
            sub="Default prices & compliance tiers"
            icon="stack"
          />
          {canManage && (
            <Btn
              variant="primary"
              size="sm"
              icon="plus"
              onClick={admin.addMaterial}
            >
              Add material
            </Btn>
          )}
        </div>
        {metalsError ? (
          <EmptyState
            tone="error"
            label="Couldn’t load materials"
            sub={metalsError}
            action={
              <Btn
                variant="ghost"
                size="sm"
                icon="reload"
                onClick={refreshMetals}
              >
                Retry
              </Btn>
            }
          />
        ) : metalsLoading && metals.length === 0 ? (
          <SkeletonRows />
        ) : metals.length === 0 ? (
          <EmptyState
            icon="stack"
            label="No materials yet"
            sub="Add the metals you buy and their default prices to get started."
            action={
              canManage ? (
                <Btn
                  variant="primary"
                  size="sm"
                  icon="plus"
                  onClick={admin.addMaterial}
                >
                  Add material
                </Btn>
              ) : undefined
            }
          />
        ) : (
          <Table cols={matCols}>
            {metals.map((m) => {
              const tier = metalTier(m);
              return (
                <TR
                  key={m.id}
                  cols={matCols}
                  accent={toneColor(tierTone(tier))}
                  onClick={
                    canManage
                      ? () =>
                          admin.editPrice({
                            id: m.id,
                            name: m.name,
                            price_per_lb: m.price_per_lb,
                            pricing_unit:
                              m.pricing_unit === 'each' ? 'each' : 'lb',
                          })
                      : undefined
                  }
                  cells={[
                    <span
                      key="name"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {m.name}
                    </span>,
                    <Pill key="tier" tone={tierTone(tier)}>
                      {tier}
                    </Pill>,
                    <span
                      key="price"
                      className="mono num"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {money(m.price_per_lb)}/
                      {m.pricing_unit === 'each' ? 'pc' : 'lb'}
                    </span>,
                  ]}
                />
              );
            })}
          </Table>
        )}
      </Card>

      {/* team — admins/owners generate invite codes; others see the note */}
      {canManage ? (
        <TeamAccess admin={admin} isOwner={isOwner} />
      ) : (
        <Card>
          <PanelHead
            title="Team & access"
            sub="Staff accounts · each has a private passcode"
            icon="user"
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 16px',
              background: 'var(--surface-2)',
              borderRadius: 14,
              border: '1px solid var(--line)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background:
                  'color-mix(in oklab, var(--accent) 13%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="user" size={20} color="var(--accent)" stroke={1.9} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}
              >
                Ask an admin to add you
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11.5,
                  color: 'var(--ink-3)',
                  marginTop: 3,
                  lineHeight: 1.5,
                }}
              >
                Only admins and owners can invite staff. Each person signs in
                with their own PIN.
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
