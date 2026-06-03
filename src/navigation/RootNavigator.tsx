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

/** Extract auth tokens from a deep link URL and set the Supabase session. */
function handleAuthDeepLink(url: string) {
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }
}

export default function RootNavigator() {
  const dispatch = useAppDispatch();
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
      handleAuthDeepLink(event.url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
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
          backgroundColor: '#0f0f23',
        }}
      >
        <ActivityIndicator size="large" color="#4ecdc4" />
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
