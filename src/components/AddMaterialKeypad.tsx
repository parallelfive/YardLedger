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

interface AddMaterialKeypadProps {
  /**
   * Called when the operator commits a line. `overridePrice` is non-null only
   * when the operator entered a different unit price — the parent screen then
   * routes it through the existing AccessCodeModal override flow so the price
   * change is still admin-gated and tracked per line item.
   */
  onAdd: (metal: Metal, weight: number, overridePrice: number | null) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

export default function AddMaterialKeypad({ onAdd }: AddMaterialKeypadProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [loading, setLoading] = useState(true);
  const [metal, setMetal] = useState<Metal | null>(null);
  const [weightStr, setWeightStr] = useState('');
  const [overridePrice, setOverridePrice] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftPrice, setDraftPrice] = useState('');

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

  const weight = parseFloat(weightStr) || 0;
  const price = overridePrice ?? (metal ? Number(metal.price_per_lb) : 0);
  const total = weight * price;
  const overridden =
    metal != null &&
    overridePrice != null &&
    overridePrice !== Number(metal.price_per_lb);

  const onKey = (k: string) => {
    if (k === 'del') {
      setWeightStr((w) => w.slice(0, -1));
      return;
    }
    if (k === '.' && weightStr.includes('.')) return;
    if (weightStr.replace('.', '').length >= 6) return;
    setWeightStr((w) => w + k);
  };

  const resetMetal = (m: Metal) => {
    setMetal(m);
    setOverridePrice(null);
    setEditing(false);
    setWeightStr('');
  };

  const commitDraftPrice = () => {
    const next = parseFloat(draftPrice);
    if (next && next > 0) setOverridePrice(next);
    setEditing(false);
  };

  const handleAdd = () => {
    if (!metal || weight <= 0) return;
    addToRecentMetals(metal);
    onAdd(metal, weight, overridden ? price : null);
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

      {/* Big weight readout */}
      <View style={styles.readout}>
        <Text style={styles.readoutWeight}>
          {weightStr || '0'}
          <Text style={styles.readoutUnit}> lb</Text>
        </Text>
        <Text style={styles.readoutPrice}>
          {fmtMoney(price)}/lb · = {fmtMoney(total)}
        </Text>
      </View>

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
        style={[styles.addButton, weight <= 0 && styles.addButtonDisabled]}
        onPress={handleAdd}
        disabled={weight <= 0}
      >
        <Ionicons
          name="add"
          size={18}
          color={weight <= 0 ? colors.textTertiary : colors.accentInk}
        />
        <Text
          style={[
            styles.addButtonText,
            weight <= 0 && styles.addButtonTextDisabled,
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
