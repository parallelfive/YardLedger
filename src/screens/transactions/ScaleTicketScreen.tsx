import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import AddMaterialKeypad from '../../components/AddMaterialKeypad';
import Button from '../../components/Button';
import Snackbar from '../../components/Snackbar';
import { MetalDot, fmtMoney, fmtLbs } from '../../components/foundry';
import type { Tone } from '../../components/foundry';
import { useAppSelector, type RootState } from '../../store';
import { createDraftTicket } from '../../services/draftTickets';
import { calculateLineItemTotal } from '../../utils/calculations';
import type { Metal } from '../../types';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'NewScaleTicket'
>;

// A weighed line the worker captured. Mirrors the desktop scale-ticket half:
// net weight (keyed or gross − tare), priced at the metal's current price.
interface Line {
  metal: Metal;
  net: number;
  gross?: number;
  tare?: number;
  // The unit price this line was captured at — the metal's catalog price, or an
  // admin-authorized override the worker keyed. Pricing flows off this so an
  // override the cashier sees matches what was entered at the scale.
  price: number;
  // Per-piece ('each') materials bill on a whole-number piece count instead of
  // net weight; `qty` carries that count and `net` stays 0.
  unit: 'lb' | 'each';
  qty: number;
}

// The billed amount for a line: piece count for 'each', net weight otherwise.
const lineAmount = (l: Line): number => (l.unit === 'each' ? l.qty : l.net);

const toneFor = (m: Metal): Tone =>
  m.is_catalytic || m.is_restricted
    ? 'rust'
    : m.is_regulated
      ? 'gold'
      : 'copper';

// Worker's half of a buy on the phone: weigh material at the scale, capture the
// vehicle next to the truck, and send a draft "scale ticket" to the cashier —
// who finalizes ID/payment at the desk. No inventory/receipt/reporting fires
// here; that's all on the cashier's finalize (createReceipt).
export default function ScaleTicketScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const activeIdentity = useAppSelector(
    (s: RootState) => s.auth.activeIdentity
  );
  const profile = useAppSelector((s: RootState) => s.auth.profile);
  const workerId = activeIdentity?.user_id ?? profile?.id ?? '';

  const [lines, setLines] = useState<Line[]>([]);
  const [seller, setSeller] = useState('');
  const [plate, setPlate] = useState('');
  const [vin, setVin] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [sending, setSending] = useState(false);
  const [claim, setClaim] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  // Weight total excludes per-piece lines (they carry no weight); piece count
  // is tallied separately for the footer.
  const weight = lines.reduce((s, l) => s + l.net, 0);
  const pieces = lines.reduce((s, l) => s + (l.unit === 'each' ? l.qty : 0), 0);
  const subtotal = lines.reduce(
    (s, l) => s + calculateLineItemTotal(lineAmount(l), l.price),
    0
  );

  const addLine = (
    metal: Metal,
    w: number,
    overridePrice: number | null,
    weightData?: { net: number; gross?: number; tare?: number },
    quantity?: number
  ) => {
    const isPiece = metal.pricing_unit === 'each';
    setLines((prev) => [
      ...prev,
      {
        metal,
        net: isPiece ? 0 : (weightData?.net ?? w),
        gross: weightData?.gross,
        tare: weightData?.tare,
        price: overridePrice ?? Number(metal.price_per_lb || 0),
        unit: isPiece ? 'each' : 'lb',
        qty: isPiece ? (quantity ?? 0) : 0,
      },
    ]);
    setShowAdd(false);
  };

  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  const send = async () => {
    if (lines.length === 0 || sending) return;
    setSending(true);
    try {
      const lineItems = lines.map((l) => ({
        metalId: l.metal.id,
        metalName: l.metal.name,
        weight: l.net,
        grossWeight: l.gross ?? null,
        tareWeight: l.tare ?? null,
        pricePerLb: l.price,
        total: calculateLineItemTotal(lineAmount(l), l.price),
        isRegulated: !!l.metal.is_regulated,
        isRestricted: !!l.metal.is_restricted,
        isCatalytic: !!l.metal.is_catalytic,
        unit: l.unit,
        quantity: l.unit === 'each' ? l.qty : null,
      }));
      const draft = await createDraftTicket({
        workerId,
        sellerName: seller.trim() || undefined,
        lineItems,
        subtotal,
        weight,
        vehiclePlate: plate.trim() || undefined,
        transportVin: vin.trim() || undefined,
      });
      setClaim(draft.claim_number);
    } catch (error) {
      setSnack((error as Error).message || 'Could not send the ticket.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setLines([]);
    setSeller('');
    setPlate('');
    setVin('');
    setClaim(null);
  };

  // ── success: hand the claim number to the customer ──────────────────────────
  if (claim) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={44} color={colors.accentInk} />
        </View>
        <Text style={styles.successEyebrow}>SENT TO CASHIER</Text>
        <Text style={styles.claim}>{claim}</Text>
        <Text style={styles.successSub}>
          Give the customer this claim number. The cashier finalizes the payout
          at the desk.
        </Text>
        <View style={styles.successActions}>
          <Button
            title="New ticket"
            variant="primary"
            onPress={reset}
            style={styles.successBtn}
          />
          <Button
            title="Done"
            variant="outline"
            onPress={() => navigation.goBack()}
            style={styles.successBtn}
          />
        </View>
      </View>
    );
  }

  const canSend = lines.length > 0 && !sending;

  return (
    <View style={styles.container}>
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Text style={styles.headerEyebrow}>SCALE TICKET</Text>
          <Text style={styles.headerTitle}>Weigh &amp; send</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* line items */}
        {lines.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="scale-outline"
              size={30}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>
              Add each material off the scale. Net weight, or gross − tare with
              a vehicle on the scale.
            </Text>
          </View>
        ) : (
          lines.map((l, i) => (
            <View key={i} style={styles.lineRow}>
              <MetalDot tone={toneFor(l.metal)} />
              <View style={styles.lineInfo}>
                <Text style={styles.lineName}>{l.metal.name}</Text>
                <Text style={styles.lineDetail}>
                  {l.unit === 'each'
                    ? `${l.qty} pcs @ ${fmtMoney(l.price)}/pc`
                    : `${l.net.toFixed(2)} lb @ ${fmtMoney(l.price)}/lb`}
                  {l.gross != null ? `  ·  gross ${l.gross.toFixed(0)}` : ''}
                </Text>
              </View>
              <Text style={styles.lineTotal}>
                {fmtMoney(lineAmount(l) * l.price)}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Remove material', `Remove ${l.metal.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => removeLine(i),
                    },
                  ])
                }
                hitSlop={8}
                style={styles.removeBtn}
              >
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={colors.accent} />
          <Text style={styles.addBtnText}>Add material</Text>
        </TouchableOpacity>

        {/* capture-at-the-scale fields (optional, pre-fill the cashier) */}
        <Text style={styles.sectionLabel}>AT THE SCALE (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={seller}
          onChangeText={setSeller}
          placeholder="Seller name"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="words"
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={plate}
            onChangeText={setPlate}
            placeholder="Plate"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
          />
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={vin}
            onChangeText={setVin}
            placeholder="Transport VIN"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
          />
        </View>
      </ScrollView>

      {/* footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <View style={styles.totals}>
          <Text style={styles.totalWeight}>
            {fmtLbs(weight)} lb
            {pieces > 0 ? ` · ${pieces} pcs` : ''}
          </Text>
          <Text style={styles.totalMoney}>{fmtMoney(subtotal)}</Text>
        </View>
        <Button
          title={sending ? 'Sending…' : 'Send to cashier'}
          variant="primary"
          onPress={send}
          loading={sending}
          disabled={!canSend}
        />
      </View>

      {/* add-material sheet */}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setShowAdd(false)}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <View style={styles.sheetGrabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add material</Text>
              <TouchableOpacity
                onPress={() => setShowAdd(false)}
                hitSlop={8}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <AddMaterialKeypad onAdd={addLine} />
          </View>
        </View>
      </Modal>

      <Snackbar
        visible={!!snack}
        message={snack ?? ''}
        onDismiss={() => setSnack(null)}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    headerEyebrow: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.2,
      color: colors.textTertiary,
    },
    headerTitle: {
      fontFamily: fonts.display,
      fontSize: fontSize.xxl,
      color: colors.textPrimary,
      marginTop: 2,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    emptyText: {
      fontFamily: fonts.sans,
      fontSize: fontSize.sm,
      color: colors.textTertiary,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 20,
    },
    lineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lineInfo: { flex: 1, minWidth: 0 },
    lineName: {
      fontFamily: fonts.sansSemiBold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    lineDetail: {
      fontFamily: fonts.mono,
      fontSize: 11.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    lineTotal: {
      fontFamily: fonts.sansBold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    removeBtn: { padding: 4 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.accentLine,
      backgroundColor: colors.accentMuted,
    },
    addBtnText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: fontSize.md,
      color: colors.accent,
    },
    sectionLabel: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 10.5,
      letterSpacing: 0.8,
      color: colors.textTertiary,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: 13,
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.lg,
      fontFamily: fonts.sans,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    row: { flexDirection: 'row', gap: spacing.sm },
    rowInput: { flex: 1 },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.md,
    },
    totals: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    totalWeight: {
      fontFamily: fonts.monoMedium,
      fontSize: fontSize.lg,
      color: colors.textSecondary,
    },
    totalMoney: {
      fontFamily: fonts.display,
      fontSize: fontSize.xxl,
      color: colors.textPrimary,
    },
    // success
    successIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    successEyebrow: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 1.4,
      color: colors.textTertiary,
    },
    claim: {
      fontFamily: fonts.display,
      fontSize: 52,
      color: colors.accent,
      marginVertical: spacing.sm,
    },
    successSub: {
      fontFamily: fonts.sans,
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      maxWidth: 300,
    },
    successActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    successBtn: { flex: 1 },
    // add sheet
    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    sheetGrabber: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sheetTitle: {
      fontFamily: fonts.sansBold,
      fontSize: fontSize.lg,
      color: colors.textPrimary,
    },
  });
