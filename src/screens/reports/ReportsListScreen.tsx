import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportsStackParamList } from '../../navigation/MainNavigator';
import { useT } from '../../hooks/useT';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

type Props = NativeStackScreenProps<ReportsStackParamList, 'ReportsList'>;

interface ReportCard {
  title: string;
  subtitle: string;
  screen: keyof ReportsStackParamList;
}

export default function ReportsListScreen({ navigation }: Props) {
  const { t } = useT();

  const reports: ReportCard[] = [
    {
      title: t.dailySummary,
      subtitle: t.dailySummaryDesc,
      screen: 'DailySummary',
    },
    {
      title: t.inventoryValuation,
      subtitle: t.inventoryValuationDesc,
      screen: 'InventoryValuation',
    },
    {
      title: t.profitability,
      subtitle: t.profitabilityDesc,
      screen: 'Profitability',
    },
    {
      title: t.shrinkage,
      subtitle: t.shrinkageDesc,
      screen: 'Shrinkage',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {reports.map((report) => (
          <TouchableOpacity
            key={report.screen}
            style={styles.card}
            onPress={() => navigation.navigate(report.screen)}
          >
            <Text style={styles.cardTitle}>{report.title}</Text>
            <Text style={styles.cardSubtitle}>{report.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    minHeight: 100,
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
});
