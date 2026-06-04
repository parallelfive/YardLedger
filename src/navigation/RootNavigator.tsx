import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import PendingApprovalScreen from '../screens/auth/PendingApprovalScreen';
import { useAppDispatch, useAppSelector, type RootState } from '../store';
import { initializeAuth, setSession, fetchProfile } from '../store/authStore';
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
  const { colors } = useTheme();
  const { session, profile, loading } = useAppSelector(
    (state: RootState) => state.auth
  );

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
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  // Logged in but not yet approved by admin
  if (!profile?.isActive) {
    return <PendingApprovalScreen />;
  }

  // Logged in and approved
  return (
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  );
}
