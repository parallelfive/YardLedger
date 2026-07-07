import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Metal } from '../types';
import { fetchMetals } from '../services/metals';
import { addToRecentMetals } from './AddLineItemModal';
import { useTarePresets } from '../hooks/useTarePresets';
import { useT } from '../hooks/useT';
import { MetalDot, Tag, fmtMoney, type Tone } from './foundry';
import { type Palette, spacing, borderRadius, fonts } from '../constants';
import { useTheme, useThemedStyles } from '../theme';

// Tone heuristic mirrors InventoryScreen — restricted/catalytic always wins.
function toneFor(metal: Metal): Tone {
  if (metal.is_catalytic || metal.is_restricted) return 'rust';
  if (metal.is_regulated) return 'gold';
  return 'moss';
}

function tierLabel(
  metal: Metal,
  t: ReturnType<typeof useT>['t']
): string | null {
  if (metal.is_catalytic) return t.tierCatalytic;
  if (metal.is_restricted) return t.tierRestricted;
  if (metal.is_regulated) return t.tierRegulated;
  return null;
}

interface WeightData {
  net: number;
  gross?: number;
  tare?: number;
}

interface AddMaterialKeypadProps {
  /**
   * Called when the operator commits a line. `overridePrice` is non-null only
   * when the operator entered a different unit price — the parent screen then
   * routes it through the existing AccessCodeModal override flow so the price
   * change is still admin-gated and tracked per line item. `weightData` is set
   * only when the line was weighed gross − tare, so the receipt records the
   * scale reading alongside the net.
   */
  onAdd: (
    metal: Metal,
    weight: number,
    overridePrice: number | null,
    weightData?: WeightData
  ) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

export default function AddMaterialKeypad({ onAdd }: AddMaterialKeypadProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { presets } = useTarePresets();
  const [metals, setMetals] = useState<Metal[]>([]);
  const [loading, setLoading] = useState(true);
  const [metal, setMetal] = useState<Metal | null>(null);
  const [weightStr, setWeightStr] = useState('');
  const [overridePrice, setOverridePrice] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftPrice, setDraftPrice] = useState('');
  // Weigh-in: net keyed directly, or gross − tare (a vehicle on the scale). In
  // tare mode the keypad drives whichever field is active.
  const [weighMode, setWeighMode] = useState<'net' | 'tare'>('net');
  const [grossStr, setGrossStr] = useState('');
  const [tareStr, setTareStr] = useState('');
  const [activeField, setActiveField] = useState<'gross' | 'tare'>('gross');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchMetals();
        if (active) setMetals(data as Metal[]);
      } catch {
        // Empty list — operator can close and retry.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const grossW = parseFloat(grossStr) || 0;
  const tareW = parseFloat(tareStr) || 0;
  // Net drives pricing in both modes: direct entry, or gross − tare clamped ≥ 0.
  const netWeight =
    weighMode === 'tare'
      ? Math.max(0, grossW - tareW)
      : parseFloat(weightStr) || 0;
  const price = overridePrice ?? (metal ? Number(metal.price_per_lb) : 0);
  const total = netWeight * price;
  const overridden =
    metal != null &&
    overridePrice != null &&
    overridePrice !== Number(metal.price_per_lb);

  // The keypad edits one string at a time — the net field, or the focused
  // gross/tare field in tare mode.
  const activeStr =
    weighMode === 'net'
      ? weightStr
      : activeField === 'gross'
        ? grossStr
        : tareStr;
  const setActiveStr = (fn: (w: string) => string) => {
    if (weighMode === 'net') setWeightStr(fn);
    else if (activeField === 'gross') setGrossStr(fn);
    else setTareStr(fn);
  };

  const onKey = (k: string) => {
    if (k === 'del') {
      setActiveStr((w) => w.slice(0, -1));
      return;
    }
    if (k === '.' && activeStr.includes('.')) return;
    if (activeStr.replace('.', '').length >= 6) return;
    setActiveStr((w) => w + k);
  };

  const resetMetal = (m: Metal) => {
    setMetal(m);
    setOverridePrice(null);
    setEditing(false);
    setWeightStr('');
    setGrossStr('');
    setTareStr('');
    setWeighMode('net');
    setActiveField('gross');
  };

  const commitDraftPrice = () => {
    const next = parseFloat(draftPrice);
    if (next && next > 0) setOverridePrice(next);
    setEditing(false);
  };

  const handleAdd = () => {
    if (!metal || netWeight <= 0) return;
    addToRecentMetals(metal);
    const weightData: WeightData | undefined =
      weighMode === 'tare'
        ? { net: netWeight, gross: grossW, tare: tareW }
        : undefined;
    onAdd(metal, netWeight, overridden ? price : null, weightData);
  };

  const list = useMemo(() => metals, [metals]);

  // ── Pick-material step ───────────────────────────────────────
  if (!metal) {
    return (
      <View>
        <Text style={styles.eyebrow}>{t.pickMaterial}</Text>
        {loading ? (
          <ActivityIndicator
            color={colors.accent}
            size="large"
            style={styles.loader}
          />
        ) : (
          <ScrollView
            style={styles.pickList}
            contentContainerStyle={styles.pickListContent}
            keyboardShouldPersistTaps="handled"
          >
            {list.map((m) => {
              const tone = toneFor(m);
              const tier = tierLabel(m, t);
              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.pickRow}
                  onPress={() => resetMetal(m)}
                  activeOpacity={0.7}
                >
                  <MetalDot tone={tone} size={11} />
                  <View style={styles.pickInfo}>
                    <Text style={styles.pickName}>{m.name}</Text>
                    <Text
                      style={[
                        styles.pickTier,
                        tier ? { color: toneTextColor(tone, colors) } : null,
                      ]}
                    >
                      {tier ?? t.tierOpen}
                    </Text>
                  </View>
                  <Text style={styles.pickPrice}>
                    {fmtMoney(Number(m.price_per_lb))}
                    <Text style={styles.pickPriceUnit}>/lb</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Keypad step ──────────────────────────────────────────────
  const tone = toneFor(metal);
  const tier = tierLabel(metal, t);
  return (
    <View>
      <TouchableOpacity
        style={styles.backRow}
        onPress={() => setMetal(null)}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
        <Text style={styles.backName}>{metal.name}</Text>
        {tier ? (
          <Tag
            label={tier}
            color={toneTextColor(tone, colors)}
            soft={toneTextColor(tone, colors) + '22'}
          />
        ) : null}
      </TouchableOpacity>

      {/* Weigh mode: net keyed directly, or gross − tare on the scale */}
      <View style={styles.modeRow}>
        {(['net', 'tare'] as const).map((md) => {
          const on = weighMode === md;
          return (
            <TouchableOpacity
              key={md}
              style={[styles.modeBtn, on && styles.modeBtnActive]}
              onPress={() => setWeighMode(md)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modeBtnText, on && styles.modeBtnTextActive]}
              >
                {md === 'net' ? t.netWeight : t.grossTare}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {weighMode === 'net' ? (
        /* Big net readout */
        <View style={styles.readout}>
          <Text style={styles.readoutWeight}>
            {weightStr || '0'}
            <Text style={styles.readoutUnit}> lb</Text>
          </Text>
          <Text style={styles.readoutPrice}>
            {fmtMoney(price)}/lb · = {fmtMoney(total)}
          </Text>
        </View>
      ) : (
        /* Gross − tare: keypad drives the highlighted field */
        <View style={styles.tareReadout}>
          <View style={styles.tareFields}>
            <TouchableOpacity
              style={[
                styles.tareField,
                activeField === 'gross' && styles.tareFieldActive,
              ]}
              onPress={() => setActiveField('gross')}
              activeOpacity={0.8}
            >
              <Text style={styles.tareFieldLabel}>{t.grossWeightLabel}</Text>
              <Text style={styles.tareFieldValue}>{grossStr || '0'}</Text>
            </TouchableOpacity>
            <Text style={styles.tareMinus}>−</Text>
            <TouchableOpacity
              style={[
                styles.tareField,
                activeField === 'tare' && styles.tareFieldActive,
              ]}
              onPress={() => setActiveField('tare')}
              activeOpacity={0.8}
            >
              <Text style={styles.tareFieldLabel}>{t.tareWeightLabel}</Text>
              <Text style={styles.tareFieldValue}>{tareStr || '0'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.tareNet}>
            {t.netWeightResult} {netWeight.toFixed(2)} lb · {fmtMoney(total)}
          </Text>
          {presets.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
              keyboardShouldPersistTaps="handled"
            >
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.presetChip}
                  onPress={() => {
                    setTareStr(String(p.tare_weight));
                    setActiveField('gross');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipName}>{p.name}</Text>
                  <Text style={styles.presetChipWeight}>
                    {p.tare_weight} lb
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}

      {/* Unit price + override */}
      <View
        style={[
          styles.priceRow,
          { borderColor: overridden ? colors.accentLine : colors.border },
        ]}
      >
        {editing ? (
          <>
            <Text style={styles.priceEditLabel}>{t.unitPriceOverride}</Text>
            <View style={styles.priceEditControls}>
              <TextInput
                style={styles.priceInput}
                value={draftPrice}
                onChangeText={setDraftPrice}
                keyboardType="decimal-pad"
                autoFocus
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
              />
              <TouchableOpacity
                style={styles.priceConfirm}
                onPress={commitDraftPrice}
              >
                <Ionicons name="checkmark" size={16} color={colors.accentInk} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View>
              <Text style={styles.priceLabel}>
                {t.unitPrice}
                {overridden ? ` · ${t.override.toLowerCase()}` : ''}
              </Text>
              <View style={styles.priceValueRow}>
                <Text style={styles.priceValue}>{fmtMoney(price)}</Text>
                {overridden ? (
                  <Text style={styles.priceStrike}>
                    {fmtMoney(Number(metal.price_per_lb))}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={styles.overrideButton}
              onPress={() => {
                setDraftPrice(price.toFixed(2));
                setEditing(true);
              }}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.overrideButtonText}>{t.overrideAction}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((k) => (
          <TouchableOpacity
            key={k}
            style={styles.key}
            onPress={() => onKey(k)}
            activeOpacity={0.6}
          >
            {k === 'del' ? (
              <Ionicons
                name="backspace-outline"
                size={20}
                color={colors.textSecondary}
              />
            ) : (
              <Text style={styles.keyText}>{k}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.addButton, netWeight <= 0 && styles.addButtonDisabled]}
        onPress={handleAdd}
        disabled={netWeight <= 0}
      >
        <Ionicons
          name="add"
          size={18}
          color={netWeight <= 0 ? colors.textTertiary : colors.accentInk}
        />
        <Text
          style={[
            styles.addButtonText,
            netWeight <= 0 && styles.addButtonTextDisabled,
          ]}
        >
          {t.addAmount} {fmtMoney(total)}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Slightly muted variant of the tone for the small tier subtitle.
function toneTextColor(tone: Tone, colors: Palette): string {
  switch (tone) {
    case 'rust':
      return colors.rust;
    case 'gold':
      return colors.gold;
    case 'moss':
      return colors.moss;
    default:
      return colors.textTertiary;
  }
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    eyebrow: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.md,
    },
    loader: { marginTop: spacing.xl },
    pickList: { maxHeight: 380 },
    pickListContent: { gap: 7, paddingBottom: spacing.sm },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: 13,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickInfo: { flex: 1 },
    pickName: {
      color: colors.textPrimary,
      fontSize: 14.5,
      fontFamily: fonts.sansSemiBold,
    },
    pickTier: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
      marginTop: 1,
    },
    pickPrice: {
      color: colors.accent,
      fontSize: 13.5,
      fontFamily: fonts.monoSemiBold,
    },
    pickPriceUnit: { color: colors.textTertiary, fontFamily: fonts.mono },

    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.md,
    },
    backName: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: fonts.sansSemiBold,
    },

    readout: { alignItems: 'center', paddingVertical: spacing.md },
    readoutWeight: {
      color: colors.textPrimary,
      fontSize: 46,
      fontFamily: fonts.display,
      letterSpacing: -1,
    },
    readoutUnit: {
      fontSize: 18,
      color: colors.textTertiary,
      fontFamily: fonts.mono,
    },
    readoutPrice: {
      color: colors.accent,
      fontSize: 14,
      fontFamily: fonts.monoSemiBold,
      marginTop: spacing.sm,
    },

    modeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    modeBtnActive: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accentLine,
    },
    modeBtnText: {
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    modeBtnTextActive: { color: colors.accent },

    tareReadout: { paddingVertical: spacing.sm },
    tareFields: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    tareField: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    tareFieldActive: { borderColor: colors.accent },
    tareFieldLabel: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.mono,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    tareFieldValue: {
      color: colors.textPrimary,
      fontSize: 24,
      fontFamily: fonts.monoSemiBold,
      marginTop: 2,
    },
    tareMinus: {
      color: colors.textTertiary,
      fontSize: 20,
      fontFamily: fonts.monoSemiBold,
    },
    tareNet: {
      color: colors.accent,
      fontSize: 14,
      fontFamily: fonts.monoSemiBold,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    presetRow: { gap: 7, paddingTop: spacing.sm, paddingRight: spacing.sm },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 99,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetChipName: {
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: fonts.sansSemiBold,
    },
    presetChipWeight: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
    },

    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 13,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      marginBottom: spacing.md,
    },
    priceLabel: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.mono,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    priceValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 1,
    },
    priceValue: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fonts.monoSemiBold,
    },
    priceStrike: {
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: fonts.mono,
      textDecorationLine: 'line-through',
    },
    overrideButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.chip,
    },
    overrideButtonText: {
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: fonts.sansSemiBold,
    },
    priceEditLabel: {
      color: colors.accent,
      fontSize: 10,
      fontFamily: fonts.mono,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    priceEditControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    priceInput: {
      width: 96,
      textAlign: 'right',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.accent,
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fonts.mono,
    },
    priceConfirm: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },

    keypad: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    key: {
      width: '31.5%',
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyText: {
      color: colors.textPrimary,
      fontSize: 21,
      fontFamily: fonts.monoSemiBold,
    },

    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingVertical: 15,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.accent,
    },
    addButtonDisabled: { backgroundColor: colors.border },
    addButtonText: {
      color: colors.accentInk,
      fontSize: 16,
      fontFamily: fonts.sansBold,
    },
    addButtonTextDisabled: { color: colors.textTertiary },
  });
