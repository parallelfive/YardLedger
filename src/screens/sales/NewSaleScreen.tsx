import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from '../../navigation/MainNavigator';
import { useT } from '../../hooks/useT';
import { useAppDispatch, useAppSelector, type RootState } from '../../store';
import { setPendingOutbox } from '../../store/appStore';
import { fetchInventory } from '../../services/inventory';
import { createSale } from '../../services/sales';
import { enqueueSale } from '../../services/outbox';
import {
  MetalDot,
  fmtMoney,
  fmtLbs,
  type Tone,
} from '../../components/foundry';
import { ResponsiveContainer } from '../../components';
import { type Palette, spacing, fontSize, fonts } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

// Visual tone from the (DB-managed) category name — heuristic only, restricted
// always wins. Mirrors InventoryScreen so colours stay consistent.
function toneFor(category: string | undefined, restricted: boolean): Tone {
  if (restricted) return 'rust';
  switch (category) {
    case 'Copper':
      return 'copper';
    case 'Brass':
      return 'gold';
    case 'Aluminum':
    case 'Steel':
      return 'steel';
    default:
      return 'ink3';
  }
}

interface InvRow {
  id: string;
  metalId: string;
  metalName: string;
  weight: number;
  avgCost: number;
  tone: Tone;
}

type Props = NativeStackScreenProps<SalesStackParamList, 'NewSale'>;

export default function NewSaleScreen({ navigation }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  // Attribute the sale to the staffer on shift (PIN'd in), not the device user.
  const activeIdentity = useAppSelector(
    (state: RootState) => state.auth.activeIdentity
  );
  const isOnline = useAppSelector((state: RootState) => state.app.isOnline);
  const dispatch = useAppDispatch();

  const [buyerName, setBuyerName] = useState('');
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saleWeight, setSaleWeight] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Refresh on focus (not just mount) so re-opening the screen after a sale
  // shows the updated on-hand weights instead of stale data.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingInventory(true);
      (async () => {
        try {
          const data = await fetchInventory();
          if (!active) return;
          const rows: InvRow[] = (data as unknown[])
            .map((raw) => {
              const item = raw as Record<string, unknown>;
              const metals = (
                Array.isArray(item.metals) ? item.metals[0] : item.metals
              ) as Record<string, unknown> | undefined;
              const mc = metals?.metal_categories as
                | { name?: string }
                | { name?: string }[]
                | undefined;
              const category = (Array.isArray(mc) ? mc[0]?.name : mc?.name) as
                | string
                | undefined;
              const restricted = Boolean(metals?.is_restricted);
              return {
                id: String(item.id),
                metalId: String(item.metal_id),
                metalName: String(item.metal_name ?? metals?.name ?? ''),
                weight: Number(item.weight),
                avgCost: Number(item.avg_cost_per_lb),
                tone: toneFor(category, restricted),
              };
            })
            .filter((r) => r.weight > 0);
          setInventory(rows);
        } catch {
          if (active) setInventory([]);
        } finally {
          if (active) setLoadingInventory(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const selected = useMemo(
    () => inventory.find((r) => r.id === selectedId) ?? null,
    [inventory, selectedId]
  );

  const weight = parseFloat(saleWeight) || 0;
  const price = parseFloat(salePrice) || 0;
  const total = weight * price;
  const onHand = selected ? selected.weight : 0;
  const oversell = !!selected && weight > onHand;
  const canRecord =
    !!selected && !!buyerName.trim() && weight > 0 && price > 0 && !oversell;

  const selectMetal = (row: InvRow) => {
    setSelectedId(row.id);
    // Leave the price blank so the operator must enter a real sale price.
    // Pre-filling with avg COST silently booked every default sale at cost,
    // i.e. profit = $0 — the whole point of profit tracking was lost.
    setSalePrice('');
  };

  const handleSave = async () => {
    if (!selected || !canRecord || !profile) return;
    const saleParams = {
      metalId: selected.metalId,
      metalName: selected.metalName,
      weight,
      salePricePerLb: price,
      costBasisPerLb: selected.avgCost,
      buyerName: buyerName.trim() || undefined,
      workerId: activeIdentity?.user_id ?? profile.id,
    };
    setSaving(true);
    try {
      if (!isOnline) {
        // Queue the sale; the server validates oversell on replay (best-effort
        // check happened in the UI against cached inventory).
        const n = await enqueueSale(saleParams);
        dispatch(setPendingOutbox(n));
        Alert.alert(t.savedOffline, t.willSyncMsg, [
          { text: t.ok, onPress: () => navigation.navigate('SalesList') },
        ]);
        return;
      }
      await createSale(saleParams);
      Alert.alert(t.success, t.saleSaved, [
        { text: t.ok, onPress: () => navigation.navigate('SalesList') },
      ]);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>{t.newLabel}</Text>
              <Text style={styles.title}>{t.newSaleTitle}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
              accessibilityLabel={t.close}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContainer maxWidth={640}>
            {/* Buyer */}
            <Text style={styles.fieldLabel}>{t.buyerProcessor}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.buyerProcessorHint}
              placeholderTextColor={colors.textTertiary}
              value={buyerName}
              onChangeText={setBuyerName}
            />

            {/* Material picker */}
            <Text style={styles.fieldLabel}>{t.materialLabel}</Text>
            {loadingInventory ? (
              <ActivityIndicator color={colors.accent} style={styles.loader} />
            ) : inventory.length === 0 ? (
              <View style={styles.emptyPicker}>
                <Text style={styles.emptyText}>{t.noInventory}</Text>
              </View>
            ) : (
              <View style={styles.materialList}>
                {inventory.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <TouchableOpacity
                      key={row.id}
                      style={[
                        styles.materialRow,
                        active && styles.materialActive,
                      ]}
                      onPress={() => selectMetal(row)}
                      activeOpacity={0.7}
                    >
                      <MetalDot tone={row.tone} size={10} />
                      <Text style={styles.materialName} numberOfLines={1}>
                        {row.metalName}
                      </Text>
                      <Text style={styles.materialAvail}>
                        {fmtLbs(row.weight)} {t.lbAvail}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Weight + Price */}
            <View style={styles.fieldsRow}>
              <View style={styles.fieldCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabelInline}>{t.weightLb}</Text>
                  {selected ? (
                    <Text style={styles.fieldHint}>
                      {fmtLbs(onHand)} {t.onHandShort}
                    </Text>
                  ) : null}
                </View>
                <TextInput
                  style={[styles.input, styles.inputMono]}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  value={saleWeight}
                  onChangeText={setSaleWeight}
                  keyboardType="decimal-pad"
                  editable={!!selected}
                />
              </View>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabelInline}>{t.priceLbShort}</Text>
                <TextInput
                  style={[styles.input, styles.inputMono]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  value={salePrice}
                  onChangeText={setSalePrice}
                  keyboardType="decimal-pad"
                  editable={!!selected}
                />
              </View>
            </View>

            {/* Oversell guard */}
            {oversell && (
              <View style={styles.guardBanner}>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.rust}
                />
                <Text style={styles.guardText}>
                  {t.cannotSell} {fmtLbs(weight)} {t.lbWord} {t.onlyWord}{' '}
                  {fmtLbs(onHand)} {t.lbOnHand}
                </Text>
              </View>
            )}

            {/* Sale total */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t.saleTotalLabel}</Text>
              <Text style={styles.totalValue}>{fmtMoney(total)}</Text>
            </View>
          </ResponsiveContainer>
        </ScrollView>

        {/* Footer */}
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}
        >
          <TouchableOpacity
            style={[styles.recordBtn, !canRecord && styles.recordBtnDisabled]}
            onPress={handleSave}
            disabled={!canRecord || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.accentInk} />
            ) : (
              <>
                <Ionicons
                  name="cube-outline"
                  size={18}
                  color={canRecord ? colors.accentInk : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.recordText,
                    !canRecord && styles.recordTextDisabled,
                  ]}
                >
                  {oversell
                    ? t.exceedsOnHand
                    : `${t.record} ${fmtMoney(total)} ${t.saleWord}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
      marginTop: 3,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    fieldLabel: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    fieldLabelInline: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    fieldHint: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.mono,
    },
    input: {
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      fontSize: 15.5,
      fontFamily: fonts.sans,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    inputMono: {
      fontFamily: fonts.mono,
      letterSpacing: 0.5,
      marginBottom: 0,
    },
    loader: { paddingVertical: spacing.lg },
    emptyPicker: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      textAlign: 'center',
    },
    materialList: {
      gap: 7,
      marginBottom: spacing.md,
    },
    materialRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    materialActive: {
      backgroundColor: colors.teal + '1A',
      borderColor: colors.teal,
    },
    materialName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fonts.sansSemiBold,
    },
    materialAvail: {
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: fonts.mono,
    },
    fieldsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: spacing.md,
    },
    fieldCol: { flex: 1 },
    guardBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 11,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: colors.rust + '17',
      borderWidth: 1,
      borderColor: colors.rust + '42',
      marginBottom: spacing.md,
    },
    guardText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: fonts.sans,
    },
    totalCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fonts.sansBold,
    },
    totalValue: {
      color: colors.teal,
      fontSize: 24,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    recordBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      borderRadius: 14,
      backgroundColor: colors.teal,
    },
    recordBtnDisabled: {
      backgroundColor: colors.borderSubtle,
    },
    recordText: {
      color: colors.accentInk,
      fontSize: 16,
      fontFamily: fonts.sansBold,
    },
    recordTextDisabled: {
      color: colors.textTertiary,
    },
  });
