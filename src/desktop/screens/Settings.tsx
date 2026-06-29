import type { ReactNode } from 'react';
import { useCurrentCompany } from '../../hooks';
import { useMetals } from '../../hooks/useMetals';
import type { Metal } from '../../types';
import Icon from '../Icon';
import {
  Card,
  PanelHead,
  Table,
  TR,
  Pill,
  Btn,
  Field,
  GroupLabel,
  TareMark,
  money,
  toneColor,
  tierTone,
  type Col,
} from '../ui';

// NM-locked compliance preset. In production these derive from
// company_settings (per-company state rules); this build ships New Mexico.
const NM_RULES = {
  state: 'New Mexico',
  holdGeneral: 1,
  holdCatalytic: 60,
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

export default function Settings({ canManage }: { canManage: boolean }) {
  const company = useCurrentCompany();
  const { metals } = useMetals();

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
                <Btn variant="subtle" size="sm" icon="edit">
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
          <InfoRow k="License" v="—" />
          <InfoRow k="EIN" v="—" />
          <InfoRow k="Registry ID" v="—" />
          <InfoRow k="Phone" v="—" />
          <InfoRow k="Address" v="—" />
          <GroupLabel style={{ marginTop: 14, lineHeight: 1.5 }}>
            License, EIN & contact details live in company settings — manage
            them from the mobile app.
          </GroupLabel>
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
              value={NM_RULES.state}
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
              <option>{NM_RULES.state}</option>
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <RuleStat
              n={NM_RULES.holdGeneral}
              unit="day"
              label="General hold"
            />
            <RuleStat
              n={NM_RULES.holdCatalytic}
              unit="days"
              label="Catalytic hold"
              tone="var(--gold)"
            />
            <RuleStat
              n={NM_RULES.retainGeneral}
              unit="yr"
              label="Retain records"
            />
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
                tone={NM_RULES.checkOnlyCat ? 'var(--rust)' : 'var(--ink-3)'}
                icon={NM_RULES.checkOnlyCat ? 'check' : 'x'}
              >
                {NM_RULES.checkOnlyCat ? 'Enforced' : 'Off'}
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
            <Btn variant="primary" size="sm" icon="plus">
              Add material
            </Btn>
          )}
        </div>
        <Table cols={matCols}>
          {metals.map((m) => {
            const tier = metalTier(m);
            return (
              <TR
                key={m.id}
                cols={matCols}
                accent={toneColor(tierTone(tier))}
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
                    {money(m.price_per_lb)}/lb
                  </span>,
                ]}
              />
            );
          })}
        </Table>
      </Card>

      {/* team */}
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
              background: 'color-mix(in oklab, var(--accent) 13%, transparent)',
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
              style={{
                fontSize: 14,
                fontWeight: 650,
                color: 'var(--ink)',
              }}
            >
              Manage staff from the mobile app
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
              Staff are invited, approved and assigned a private passcode from
              the account sheet. Each person signs in with their own PIN.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
