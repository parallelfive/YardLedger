import { useEffect, useMemo, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { ActivityIndicator, View, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import DesktopShell from '../desktop/DesktopShell';
import { useResponsive } from '../hooks/useResponsive';
import PendingApprovalScreen from '../screens/auth/PendingApprovalScreen';
import PasscodeGate from './PasscodeGate';
import AutoLock from './AutoLock';
import SetAdminPinScreen from '../screens/auth/SetAdminPinScreen';
import { useAppDispatch, useAppSelector, type RootState } from '../store';
import { initializeAuth, setSession, fetchProfile } from '../store/authStore';
import { currentUserHasPin } from '../services/admin';
import { supabase } from '../config/supabase';
import { useTheme } from '../theme';

/** Extract auth tokens from a deep link URL and set the Supabase session.
 * Only the expected auth callback path may set a session — otherwise any
 * `yardledger://...#access_token=...` link could fixate an attacker's session. */
async function handleAuthDeepLink(url: string) {
  const parsed = Linking.parse(url);
  if (parsed.hostname !== 'auth' || parsed.path !== 'callback') return;
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    try {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch {
      // Invalid/expired tokens — ignore rather than crashing the link handler.
    }
  }
}

export default function RootNavigator() {
  const dispatch = useAppDispatch();
  const { colors, isLight } = useTheme();
  const { isDesktop } = useResponsive();
  const { session, profile, loading, activeIdentity } = useAppSelector(
    (state: RootState) => state.auth
  );
  // Admins/owners need a PIN to open elevation windows; gate them to set one.
  const [needsPin, setNeedsPin] = useState(false);
  const role = profile?.role;
  const isActive = profile?.isActive;

  // Theme the NavigationContainer so scene/card backgrounds match the palette
  // (otherwise dark mode flashes a white background during transitions).
  const navTheme = useMemo(() => {
    const base = isLight ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.borderSubtle,
        primary: colors.accent,
        notification: colors.accent,
      },
    };
  }, [isLight, colors]);

  useEffect(() => {
    dispatch(initializeAuth());

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      dispatch(setSession(s));
      if (event === 'SIGNED_IN' && s?.user) {
        dispatch(fetchProfile(s.user.id));
      }
    });

    // Handle email verification deep link
    const linkingSub = Linking.addEventListener('url', (event) => {
      void handleAuthDeepLink(event.url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void handleAuthDeepLink(url);
    });

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, [dispatch]);

  // An admin/owner with no PIN can't authorize anything → prompt them to set one.
  useEffect(() => {
    let cancelled = false;
    if (session && isActive && (role === 'admin' || role === 'owner')) {
      currentUserHasPin()
        .then((has) => {
          if (!cancelled) setNeedsPin(!has);
        })
        .catch(() => {
          if (!cancelled) setNeedsPin(false);
        });
    } else {
      setNeedsPin(false);
    }
    return () => {
      cancelled = true;
    };
  }, [session, isActive, role]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <NavigationContainer theme={navTheme}>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  // Logged in but not yet approved by admin
  if (!profile?.isActive) {
    return <PendingApprovalScreen />;
  }

  // Admin/owner without a PIN must set one before they can authorize admin work.
  if ((profile.role === 'admin' || profile.role === 'owner') && needsPin) {
    return <SetAdminPinScreen onDone={() => setNeedsPin(false)} />;
  }

  // Device has a company session but the terminal is locked → passcode pad.
  if (!activeIdentity) {
    return <PasscodeGate />;
  }

  // Logged in, approved, and a staff identity is attributed for the shift.
  // On a wide desktop browser, render the dedicated desktop shell (rail +
  // topbar + tables) instead of the mobile tab navigator.
  if (Platform.OS === 'web' && isDesktop) {
    return (
      <AutoLock>
        <DesktopShell />
      </AutoLock>
    );
  }

  return (
    <AutoLock>
      <NavigationContainer theme={navTheme}>
        <MainNavigator />
      </NavigationContainer>
    </AutoLock>
  );
}
