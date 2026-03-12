import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import UserApprovalScreen from '../screens/admin/UserApprovalScreen';
import PricingScreen from '../screens/admin/PricingScreen';
import CompanyProfileScreen from '../screens/admin/CompanyProfileScreen';
import { useAppSelector, useAppDispatch, type RootState } from '../store';
import { signOut } from '../store/authStore';
import { useT } from '../hooks/useT';
import { colors, fontSize, spacing } from '../constants';

export type MainTabParamList = {
  TransactionsTab: undefined;
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

export type ReportsStackParamList = {
  ReportsList: undefined;
  DailySummary: undefined;
  InventoryValuation: undefined;
  Profitability: undefined;
  Shrinkage: undefined;
};

export type AdminStackParamList = {
  Users: undefined;
  Pricing: undefined;
  CompanyProfile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const TransactionsStack =
  createNativeStackNavigator<TransactionsStackParamList>();
const SalesStack = createNativeStackNavigator<SalesStackParamList>();
const ReportsStack = createNativeStackNavigator<ReportsStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

function TransactionsNavigator() {
  const { t } = useT();
  const dispatch = useAppDispatch();
  return (
    <TransactionsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
      }}
    >
      <TransactionsStack.Screen
        name="TransactionsList"
        component={TransactionsScreen}
        options={{
          title: t.transactions,
          headerRight: () => (
            <TouchableOpacity
              style={navStyles.signOutButton}
              onPress={() => dispatch(signOut())}
            >
              <Text style={navStyles.signOutText}>{t.signOut}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <TransactionsStack.Screen
        name="NewTransaction"
        component={NewTransactionScreen}
        options={{ title: t.newBuy }}
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
    <SalesStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
      }}
    >
      <SalesStack.Screen
        name="SalesList"
        component={SalesScreen}
        options={{ title: t.tabSales }}
      />
      <SalesStack.Screen
        name="NewSale"
        component={NewSaleScreen}
        options={{ title: t.newSale }}
      />
    </SalesStack.Navigator>
  );
}

function ReportsNavigator() {
  const { t } = useT();
  return (
    <ReportsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
      }}
    >
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
    </ReportsStack.Navigator>
  );
}

function AdminNavigator() {
  const { t } = useT();
  return (
    <AdminStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
      }}
    >
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
        name="CompanyProfile"
        component={CompanyProfileScreen}
        options={{ title: t.companyProfile }}
      />
    </AdminStack.Navigator>
  );
}

export default function MainNavigator() {
  const { t } = useT();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const isAdmin = profile?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
        headerRight: () => (
          <TouchableOpacity
            style={navStyles.signOutButton}
            onPress={() => dispatch(signOut())}
          >
            <Text style={navStyles.signOutText}>{t.signOut}</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tab.Screen
        name="TransactionsTab"
        component={TransactionsNavigator}
        options={{ title: t.tabBuy, headerShown: false }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: t.tabInventory }}
      />
      <Tab.Screen
        name="SalesTab"
        component={SalesNavigator}
        options={{ title: t.tabSales, headerShown: false }}
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
  signOutButton: {
    marginRight: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  signOutText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
