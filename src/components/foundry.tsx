// foundry.tsx — shared "Foundry" design vocabulary, ported to React Native
// from the Claude Design prototype (components.jsx). Theme-aware: styles are
// built from the active palette so they switch live with the theme.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  spacing,
  borderRadius,
  fonts,
  activeColors,
  type Palette,
} from '../constants';
import { useTheme, useThemedStyles } from '../theme';

// ── formatters ──────────────────────────────────────────────
export const fmtMoney = (n: number, dp = 2) =>
  '$' +
  Number(n).toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
export const fmtMoney0 = (n: number) =>
  '$' + Math.round(Number(n)).toLocaleString('en-US');
export const fmtLbs = (n: number) =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 1 : 0 });

export type Tone =
  | 'copper'
  | 'gold'
  | 'steel'
  | 'steel2'
  | 'rust'
  | 'moss'
  | 'ink3';

// Non-hook: reads the live module-level palette (kept in sync by ThemeProvider),
// so it's safe to call from anywhere and reflects the current theme.
export const toneColor = (t: Tone): string =>
  ({
    copper: activeColors.accent,
    gold: activeColors.gold,
    steel: activeColors.teal,
    steel2: '#8a93a0',
    rust: activeColors.rust,
    moss: activeColors.moss,
    ink3: activeColors.textTertiary,
  })[t] ?? activeColors.accent;

// ── section label (uppercase eyebrow + optional action) ─────
export function SectionLabel({
  children,
  actionLabel,
  onAction,
}: {
  children: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeS);
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionLabel}>{children}</Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} style={s.sectionAction}>
          <Text style={s.sectionActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── uppercase mono pill ─────────────────────────────────────
export function Tag({
  label,
  color,
  soft,
  icon,
}: {
  label: string;
  color?: string;
  soft?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeS);
  const c = color ?? colors.textSecondary;
  return (
    <View
      style={[
        s.tag,
        soft ? { backgroundColor: soft, paddingHorizontal: 8 } : null,
      ]}
    >
      {icon ? <Ionicons name={icon} size={12} color={c} /> : null}
      <Text style={[s.tagText, { color: c }]}>{label}</Text>
    </View>
  );
}

export function MetalDot({ tone, size = 9 }: { tone: Tone; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: tone === 'rust' ? 2 : 99,
        backgroundColor: toneColor(tone),
      }}
    />
  );
}

// ── delta tag (up/down) ─────────────────────────────────────
export function DeltaTag({ up, children }: { up: boolean; children: string }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeS);
  const c = up ? colors.moss : colors.rust;
  return (
    <View style={s.deltaRow}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={c} />
      <Text style={[s.deltaText, { color: c }]}>{children}</Text>
    </View>
  );
}

// ── mini stat card ──────────────────────────────────────────
export function MiniStat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const s = useThemedStyles(makeS);
  const c = toneColor(tone);
  return (
    <View style={s.miniCard}>
      <View style={[s.miniIcon, { backgroundColor: c + '24' }]}>
        <Ionicons name={icon} size={15} color={c} />
      </View>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={s.miniValue}>{value}</Text>
      {sub ? <Text style={s.miniSub}>{sub}</Text> : null}
    </View>
  );
}

// ── segmented metal-mix bar + legend ────────────────────────
export function MetalMixBar({
  data,
}: {
  data: { name: string; pct: number; tone: Tone }[];
}) {
  const s = useThemedStyles(makeS);
  return (
    <>
      <View style={s.mixBar}>
        {data.map((m) => (
          <View
            key={m.name}
            style={{ flex: m.pct, backgroundColor: toneColor(m.tone) }}
          />
        ))}
      </View>
      <View style={s.mixLegend}>
        {data.map((m) => (
          <View key={m.name} style={s.mixLegendItem}>
            <MetalDot tone={m.tone} />
            <Text style={s.mixLegendName}>{m.name}</Text>
            <Text style={s.mixLegendPct}>{Math.round(m.pct * 100)}%</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ── ticket / intake row ─────────────────────────────────────
export function TicketRow({
  customer,
  meta,
  total,
  sub,
  restricted,
  icon = 'receipt-outline',
  iconColor,
  totalColor,
  onPress,
  onLongPress,
}: {
  customer: string;
  meta: string;
  total: string;
  sub?: string;
  restricted?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  totalColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeS);
  const ic = iconColor ?? colors.accent;
  return (
    <TouchableOpacity
      style={s.ticket}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[s.ticketIcon, { backgroundColor: ic + '24' }]}>
        <Ionicons name={icon} size={19} color={ic} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.ticketTitleRow}>
          <Text style={s.ticketCustomer} numberOfLines={1}>
            {customer}
          </Text>
          {restricted ? (
            <Ionicons name="warning" size={14} color={colors.rust} />
          ) : null}
        </View>
        <Text style={s.ticketMeta}>{meta}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={[s.ticketTotal, totalColor ? { color: totalColor } : null]}
        >
          {total}
        </Text>
        {sub ? <Text style={s.ticketSub}>{sub}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ── sparkline (native bar rendition of the area chart) ──────
export function Sparkline({
  data,
  height = 48,
  color,
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const c = color ?? colors.accent;
  if (!data.length) return <View style={{ height }} />;
  const max = Math.max(...data, 1);
  return (
    <View style={[sparkRow, { height }]}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(3, (v / max) * height),
            backgroundColor: i === data.length - 1 ? c : c + '66',
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

const sparkRow = {
  flexDirection: 'row',
  alignItems: 'flex-end',
  gap: 3,
} as const;

const makeS = (colors: Palette) =>
  StyleSheet.create({
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    sectionLabel: {
      fontFamily: fonts.mono,
      fontSize: 11.5,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    sectionActionText: {
      fontFamily: fonts.monoMedium,
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.accent,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 3,
      borderRadius: borderRadius.pill,
    },
    tagText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 11,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    deltaText: { fontFamily: fonts.monoMedium, fontSize: 11.5 },
    miniCard: {
      flex: 1,
      padding: 14,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    miniIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 9,
    },
    miniLabel: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    miniValue: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 21,
      color: colors.textPrimary,
      marginTop: 3,
    },
    miniSub: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    mixBar: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 6,
      overflow: 'hidden',
      gap: 2,
      marginBottom: spacing.md,
    },
    mixLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    mixLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginRight: 16,
    },
    mixLegendName: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: fonts.sansMedium,
    },
    mixLegendPct: {
      fontSize: 12,
      color: colors.textTertiary,
      fontFamily: fonts.mono,
    },
    ticket: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ticketIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ticketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ticketCustomer: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 15,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    ticketMeta: {
      fontFamily: fonts.mono,
      fontSize: 11.5,
      color: colors.textTertiary,
      marginTop: 1,
      letterSpacing: 0.2,
    },
    ticketTotal: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 15.5,
      color: colors.textPrimary,
    },
    ticketSub: {
      fontFamily: fonts.mono,
      fontSize: 11.5,
      color: colors.textTertiary,
      marginTop: 1,
    },
  });
