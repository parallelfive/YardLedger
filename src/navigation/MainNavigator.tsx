import { useState } from 'react';
import { TouchableOpacity, Text, View, Modal, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { colors, fontSize, spacing, fonts, isLightTheme } from '../constants';

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

function SettingsButton() {
  const { t, language } = useT();
  const dispatch = useAppDispatch();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={navStyles.settingsButton}
        onPress={() => setVisible(true)}
      >
        <Ionicons
          name="settings-outline"
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
              onPress={() => {
                setVisible(false);
                void toggleThemeMode();
              }}
            >
              <Ionicons
                name={isLightTheme ? 'sunny-outline' : 'moon-outline'}
                size={22}
                color={colors.accent}
              />
              <Text style={navStyles.settingsRowText}>{t.theme}</Text>
              <Text style={navStyles.settingsRowValue}>
                {isLightTheme ? t.lightMode : t.darkMode}
              </Text>
            </TouchableOpacity>
            <View style={navStyles.settingsDivider} />
            <TouchableOpacity
              style={navStyles.settingsRow}
              onPress={() => {
                dispatch(toggleLanguage());
                setVisible(false);
              }}
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
              onPress={() => {
                setVisible(false);
                dispatch(signOut());
              }}
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
    </>
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
        options={{ title: t.tabSales }}
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
        options={{ title: t.tabReports }}
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

export default function MainNavigator() {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          paddingTop: spacing.xs,
          height: 88,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontFamily: fonts.sansSemiBold,
          letterSpacing: 0.3,
        },
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
        options={{
          title: t.tabDashboard,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TransactionsTab"
        component={TransactionsNavigator}
        options={{
          title: t.tabBuy,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CustomersTab"
        component={CustomersNavigator}
        options={{
          title: t.tabCustomers,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          title: t.tabInventory,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SalesTab"
        component={SalesNavigator}
        options={{
          title: t.tabSales,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="ReportsTab"
          component={ReportsNavigator}
          options={{
            title: t.tabReports,
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      {isAdmin && (
        <Tab.Screen
          name="AdminTab"
          component={AdminNavigator}
          options={{
            title: t.tabAdmin,
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-outline" size={size} color={color} />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}

const navStyles = StyleSheet.create({
  settingsButton: {
    marginRight: spacing.md,
    padding: spacing.sm,
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
