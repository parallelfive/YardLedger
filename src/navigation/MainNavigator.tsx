import { useState } from 'react';
import { TouchableOpacity, Text, View, Modal, StyleSheet } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TransactionsScreen from '../screens/transactions/TransactionsScreen';
import NewTransactionScreen from '../screens/transactions/NewTransactionScreen';
import ReceiptDetailScreen from '../screens/transactions/ReceiptDetailScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import SalesScreen from '../screens/sales/SalesScreen';
import NewSaleScreen from '../screens/sales/NewSaleScreen';
import ReportsListScreen from '../screens/reports/ReportsListScreen';
import DailySummaryScreen from '../screens/reports/DailySummaryScreen';
import InventoryValuationScreen from '../screens/reports/InventoryValuationScreen';
import ProfitabilityScreen from '../screens/reports/ProfitabilityScreen';
import ShrinkageScreen from '../screens/reports/ShrinkageScreen';
import ComplianceReportScreen from '../screens/reports/ComplianceReportScreen';
import OnHoldScreen from '../screens/reports/OnHoldScreen';
import ReportingStatusScreen from '../screens/reports/ReportingStatusScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import CustomerListScreen from '../screens/customers/CustomerListScreen';
import CustomerProfileScreen from '../screens/customers/CustomerProfileScreen';
import MarketPricesScreen from '../screens/admin/MarketPricesScreen';
import UserApprovalScreen from '../screens/admin/UserApprovalScreen';
import PricingScreen from '../screens/admin/PricingScreen';
import CompanyProfileScreen from '../screens/admin/CompanyProfileScreen';
import { useAppSelector, useAppDispatch, type RootState } from '../store';
import { signOut } from '../store/authStore';
import { toggleLanguage } from '../store/settingsStore';
import { useT } from '../hooks/useT';
import { toggleThemeMode } from '../utils';
import {
  colors,
  fontSize,
  spacing,
  fonts,
  borderRadius,
  isLightTheme,
} from '../constants';

const stackScreenOptions = {
  headerStyle: {
    backgroundColor: colors.surface,
  },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.xl,
  },
  headerShadowVisible: false,
  animation: 'slide_from_right' as const,
};

export type MainTabParamList = {
  Dashboard: undefined;
  TransactionsTab: undefined;
  CustomersTab: undefined;
  Inventory: undefined;
  SalesTab: undefined;
  ReportsTab: undefined;
  AdminTab: undefined;
};

export type TransactionsStackParamList = {
  TransactionsList: undefined;
  NewTransaction: undefined;
  ReceiptDetail: { receiptId: string; printOnLoad?: boolean };
};

export type SalesStackParamList = {
  SalesList: undefined;
  NewSale: undefined;
};

export type CustomersStackParamList = {
  CustomerList: undefined;
  CustomerProfile: { customerId: string };
};

export type ReportsStackParamList = {
  ReportsList: undefined;
  DailySummary: undefined;
  InventoryValuation: undefined;
  Profitability: undefined;
  Shrinkage: undefined;
  ComplianceReport: undefined;
  OnHold: undefined;
  ReportingStatus: undefined;
};

export type AdminStackParamList = {
  Users: undefined;
  Pricing: undefined;
  MarketPrices: undefined;
  CompanyProfile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const TransactionsStack =
  createNativeStackNavigator<TransactionsStackParamList>();
const SalesStack = createNativeStackNavigator<SalesStackParamList>();
const CustomersStack = createNativeStackNavigator<CustomersStackParamList>();
const ReportsStack = createNativeStackNavigator<ReportsStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

// Top-bar controls: a quick theme toggle + an overflow menu. The menu is the
// home for areas the design keeps off the tab bar (Customers, Admin, Pricing…).
function SettingsButton() {
  const { t, language } = useT();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';
  const [visible, setVisible] = useState(false);

  const go = (target: () => void) => {
    setVisible(false);
    target();
  };
  const nav = navigation as {
    navigate: (name: string, params?: object) => void;
  };

  return (
    <View style={navStyles.headerRight}>
      <TouchableOpacity
        style={navStyles.headerIconButton}
        onPress={() => void toggleThemeMode()}
      >
        <Ionicons
          name={isLightTheme ? 'sunny-outline' : 'moon-outline'}
          size={21}
          color={colors.accent}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={navStyles.headerIconButton}
        onPress={() => setVisible(true)}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={22}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={navStyles.settingsOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={navStyles.settingsModal}>
            <TouchableOpacity
              style={navStyles.settingsRow}
              onPress={() => go(() => nav.navigate('CustomersTab'))}
            >
              <Ionicons name="people-outline" size={22} color={colors.accent} />
              <Text style={navStyles.settingsRowText}>{t.customers}</Text>
            </TouchableOpacity>
            {isAdmin && (
              <>
                <View style={navStyles.settingsDivider} />
                <TouchableOpacity
                  style={navStyles.settingsRow}
                  onPress={() =>
                    go(() => nav.navigate('AdminTab', { screen: 'Pricing' }))
                  }
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={22}
                    color={colors.accent}
                  />
                  <Text style={navStyles.settingsRowText}>{t.pricing}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={navStyles.settingsRow}
                  onPress={() =>
                    go(() => nav.navigate('AdminTab', { screen: 'Users' }))
                  }
                >
                  <Ionicons
                    name="shield-outline"
                    size={22}
                    color={colors.accent}
                  />
                  <Text style={navStyles.settingsRowText}>{t.tabUsers}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={navStyles.settingsRow}
                  onPress={() =>
                    go(() =>
                      nav.navigate('AdminTab', { screen: 'CompanyProfile' })
                    )
                  }
                >
                  <Ionicons
                    name="business-outline"
                    size={22}
                    color={colors.accent}
                  />
                  <Text style={navStyles.settingsRowText}>
                    {t.companyProfile}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <View style={navStyles.settingsDivider} />
            <TouchableOpacity
              style={navStyles.settingsRow}
              onPress={() => go(() => dispatch(toggleLanguage()))}
            >
              <Ionicons
                name="language-outline"
                size={22}
                color={colors.accent}
              />
              <Text style={navStyles.settingsRowText}>{t.language}</Text>
              <Text style={navStyles.settingsRowValue}>
                {language === 'en' ? t.english : t.spanish}
              </Text>
            </TouchableOpacity>
            <View style={navStyles.settingsDivider} />
            <TouchableOpacity
              style={navStyles.settingsRow}
              onPress={() => go(() => dispatch(signOut()))}
            >
              <Ionicons
                name="log-out-outline"
                size={22}
                color={colors.danger}
              />
              <Text
                style={[navStyles.settingsRowText, { color: colors.danger }]}
              >
                {t.signOut}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function TransactionsNavigator() {
  const { t } = useT();
  return (
    <TransactionsStack.Navigator screenOptions={stackScreenOptions}>
      <TransactionsStack.Screen
        name="TransactionsList"
        component={TransactionsScreen}
        options={{
          title: t.transactions,
          headerRight: () => <SettingsButton />,
        }}
      />
      <TransactionsStack.Screen
        name="NewTransaction"
        component={NewTransactionScreen}
        options={{ title: t.newBuy, animation: 'slide_from_bottom' }}
      />
      <TransactionsStack.Screen
        name="ReceiptDetail"
        component={ReceiptDetailScreen}
        options={{ title: t.receiptDetail }}
      />
    </TransactionsStack.Navigator>
  );
}

function SalesNavigator() {
  const { t } = useT();
  return (
    <SalesStack.Navigator screenOptions={stackScreenOptions}>
      <SalesStack.Screen
        name="SalesList"
        component={SalesScreen}
        options={{ title: t.tabSales, headerRight: () => <SettingsButton /> }}
      />
      <SalesStack.Screen
        name="NewSale"
        component={NewSaleScreen}
        options={{ title: t.newSale, animation: 'slide_from_bottom' }}
      />
    </SalesStack.Navigator>
  );
}

function CustomersNavigator() {
  const { t } = useT();
  return (
    <CustomersStack.Navigator screenOptions={stackScreenOptions}>
      <CustomersStack.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ title: t.customers }}
      />
      <CustomersStack.Screen
        name="CustomerProfile"
        component={CustomerProfileScreen}
        options={{ title: t.customerProfile }}
      />
    </CustomersStack.Navigator>
  );
}

function ReportsNavigator() {
  const { t } = useT();
  return (
    <ReportsStack.Navigator screenOptions={stackScreenOptions}>
      <ReportsStack.Screen
        name="ReportsList"
        component={ReportsListScreen}
        options={{
          title: t.tabReports,
          headerRight: () => <SettingsButton />,
        }}
      />
      <ReportsStack.Screen
        name="DailySummary"
        component={DailySummaryScreen}
        options={{ title: t.dailySummary }}
      />
      <ReportsStack.Screen
        name="InventoryValuation"
        component={InventoryValuationScreen}
        options={{ title: t.inventoryValuation }}
      />
      <ReportsStack.Screen
        name="Profitability"
        component={ProfitabilityScreen}
        options={{ title: t.profitability }}
      />
      <ReportsStack.Screen
        name="Shrinkage"
        component={ShrinkageScreen}
        options={{ title: t.shrinkage }}
      />
      <ReportsStack.Screen
        name="ComplianceReport"
        component={ComplianceReportScreen}
        options={{ title: t.complianceReport }}
      />
      <ReportsStack.Screen
        name="OnHold"
        component={OnHoldScreen}
        options={{ title: t.onHoldReport }}
      />
      <ReportsStack.Screen
        name="ReportingStatus"
        component={ReportingStatusScreen}
        options={{ title: t.reportingStatus }}
      />
    </ReportsStack.Navigator>
  );
}

function AdminNavigator() {
  const { t } = useT();
  return (
    <AdminStack.Navigator screenOptions={stackScreenOptions}>
      <AdminStack.Screen
        name="Users"
        component={UserApprovalScreen}
        options={{ title: t.tabUsers }}
      />
      <AdminStack.Screen
        name="Pricing"
        component={PricingScreen}
        options={{ title: t.pricing }}
      />
      <AdminStack.Screen
        name="MarketPrices"
        component={MarketPricesScreen}
        options={{ title: t.marketPrices }}
      />
      <AdminStack.Screen
        name="CompanyProfile"
        component={CompanyProfileScreen}
        options={{ title: t.companyProfile }}
      />
    </AdminStack.Navigator>
  );
}

// Quick-action sheet launched by the center FAB (New buy / New sale).
function QuickActions({
  visible,
  onClose,
  onBuy,
  onSale,
}: {
  visible: boolean;
  onClose: () => void;
  onBuy: () => void;
  onSale: () => void;
}) {
  const { t } = useT();
  const Row = ({
    icon,
    tone,
    label,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    tone: string;
    label: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={navStyles.quickRow} onPress={onPress}>
      <View style={[navStyles.quickIcon, { backgroundColor: tone + '22' }]}>
        <Ionicons name={icon} size={22} color={tone} />
      </View>
      <Text style={navStyles.quickLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={navStyles.quickOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={navStyles.quickSheet}>
          <View style={navStyles.quickHandle} />
          <Text style={navStyles.quickTitle}>{t.quickActions}</Text>
          <Row
            icon="add-circle-outline"
            tone={colors.accent}
            label={t.newBuyAction}
            onPress={onBuy}
          />
          <Row
            icon="cube-outline"
            tone={colors.teal}
            label={t.newSaleAction}
            onPress={onSale}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// Custom 5-slot tab bar: Home · Stock · ＋ · Sales · Reports. The ＋ is a
// raised copper FAB that opens the quick-action sheet.
function YLTabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useT();
  const [quickOpen, setQuickOpen] = useState(false);
  const currentName = state.routes[state.index]?.name;
  const has = (name: string) => state.routes.some((r) => r.name === name);
  const nav = navigation as unknown as {
    navigate: (name: string, params?: object) => void;
  };

  type Item = {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  };
  const left: Item[] = [
    { name: 'Dashboard', icon: 'home-outline', label: t.tabHome },
    { name: 'Inventory', icon: 'layers-outline', label: t.tabStock },
  ];
  const right: Item[] = [
    { name: 'SalesTab', icon: 'trending-up-outline', label: t.tabSales },
    ...(has('ReportsTab')
      ? [
          {
            name: 'ReportsTab',
            icon: 'bar-chart-outline' as const,
            label: t.tabReports,
          },
        ]
      : []),
  ];

  const renderItem = (item: Item) => {
    const active = currentName === item.name;
    const tint = active ? colors.accent : colors.textTertiary;
    return (
      <TouchableOpacity
        key={item.name}
        style={navStyles.tabItem}
        onPress={() => navigation.navigate(item.name as never)}
      >
        <Ionicons name={item.icon} size={23} color={tint} />
        <Text style={[navStyles.tabLabel, { color: tint }]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={navStyles.tabBar}>
      {left.map(renderItem)}
      <View style={navStyles.fabSlot}>
        <TouchableOpacity
          style={navStyles.fab}
          onPress={() => setQuickOpen(true)}
        >
          <Ionicons name="add" size={28} color={colors.accentInk} />
        </TouchableOpacity>
      </View>
      {right.map(renderItem)}
      <QuickActions
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onBuy={() => {
          setQuickOpen(false);
          nav.navigate('TransactionsTab', { screen: 'NewTransaction' });
        }}
        onSale={() => {
          setQuickOpen(false);
          nav.navigate('SalesTab', { screen: 'NewSale' });
        }}
      />
    </View>
  );
}

export default function MainNavigator() {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  return (
    <Tab.Navigator
      tabBar={(props) => <YLTabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: colors.shadow,
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontFamily: fonts.sansBold,
          fontSize: fontSize.xl,
        },
        headerRight: () => <SettingsButton />,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t.tabHome }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: t.tabStock }}
      />
      <Tab.Screen
        name="SalesTab"
        component={SalesNavigator}
        options={{ title: t.tabSales, headerShown: false }}
      />
      {/* Reachable from the FAB and the Home "recent intake" list, not the bar */}
      <Tab.Screen
        name="TransactionsTab"
        component={TransactionsNavigator}
        options={{ title: t.tabBuy, headerShown: false }}
      />
      {/* Reachable from the header menu, not the bar */}
      <Tab.Screen
        name="CustomersTab"
        component={CustomersNavigator}
        options={{ title: t.tabCustomers, headerShown: false }}
      />
      {isAdmin && (
        <Tab.Screen
          name="ReportsTab"
          component={ReportsNavigator}
          options={{ title: t.tabReports, headerShown: false }}
        />
      )}
      {isAdmin && (
        <Tab.Screen
          name="AdminTab"
          component={AdminNavigator}
          options={{ title: t.tabAdmin, headerShown: false }}
        />
      )}
    </Tab.Navigator>
  );
}

const navStyles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerIconButton: {
    padding: spacing.sm,
  },
  // Custom tab bar
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
    paddingBottom: 28,
    paddingHorizontal: spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
  },
  tabLabel: {
    fontSize: 9.5,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fabSlot: {
    width: 64,
    alignItems: 'center',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 17,
    marginTop: -6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // Quick actions sheet
  quickOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  quickSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickHandle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  quickTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: spacing.lg,
  },
  settingsModal: {
    backgroundColor: colors.card,
    borderRadius: 12,
    minWidth: 220,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  settingsRowText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  settingsRowValue: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
