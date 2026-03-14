import { TouchableOpacity, Text, StyleSheet } from 'react-native';
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
import UserApprovalScreen from '../screens/admin/UserApprovalScreen';
import PricingScreen from '../screens/admin/PricingScreen';
import CompanyProfileScreen from '../screens/admin/CompanyProfileScreen';
import { useAppSelector, useAppDispatch, type RootState } from '../store';
import { signOut } from '../store/authStore';
import { useT } from '../hooks/useT';
import { colors, fontSize, spacing } from '../constants';

const stackScreenOptions = {
  headerStyle: {
    backgroundColor: colors.surface,
  },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: fontSize.xl,
  },
  headerShadowVisible: false,
} as const;

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
    <TransactionsStack.Navigator screenOptions={stackScreenOptions}>
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
    <SalesStack.Navigator screenOptions={stackScreenOptions}>
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
          fontWeight: '600',
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
          fontWeight: '700',
          fontSize: fontSize.xl,
        },
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
        options={{
          title: t.tabBuy,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
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
  signOutButton: {
    marginRight: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  signOutText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
