import { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, View } from 'react-native';
import {
  useFonts,
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import {
  SplineSansMono_400Regular,
  SplineSansMono_500Medium,
  SplineSansMono_600SemiBold,
} from '@expo-google-fonts/spline-sans-mono';
import { store, useAppDispatch } from './src/store';
import { setPendingOutbox, setLastSynced } from './src/store/appStore';
import { ThemeProvider, useTheme } from './src/theme';
import RootNavigator from './src/navigation/RootNavigator';
import { AdminElevationProvider } from './src/providers/AdminElevationProvider';
import OfflineBanner from './src/components/OfflineBanner';
import { useConnectivity } from './src/hooks/useConnectivity';
import { replayOutbox, outboxCount } from './src/services/outbox';
import { useT } from './src/hooks/useT';

function ThemedApp() {
  const { colors, isLight } = useTheme();
  const { t } = useT();
  const dispatch = useAppDispatch();

  // Replay queued offline buys/sales whenever connectivity returns. Surface any
  // permanent rejections (e.g. oversell on a queued sale) so they're re-keyed.
  const onReconnect = useCallback(async () => {
    const res = await replayOutbox();
    dispatch(setPendingOutbox(res.remaining));
    // Signal focused data screens to refresh now that we're back online and the
    // queue has replayed — no manual tab switch needed.
    dispatch(setLastSynced(Date.now()));
    if (res.failed.length > 0) {
      Alert.alert(
        t.syncIssuesTitle,
        t.syncIssuesMsg.replace('{n}', String(res.failed.length))
      );
    }
  }, [dispatch, t]);
  useConnectivity(onReconnect);

  // Reflect any pending queue in the banner on launch.
  useEffect(() => {
    void outboxCount().then((n) => dispatch(setPendingOutbox(n)));
  }, [dispatch]);
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <SafeAreaProvider>
        <StatusBar style={isLight ? 'dark' : 'light'} />
        <AdminElevationProvider>
          <OfflineBanner />
          <RootNavigator />
        </AdminElevationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    SplineSansMono_400Regular,
    SplineSansMono_500Medium,
    SplineSansMono_600SemiBold,
  });

  // Render once fonts load OR if they fail — never block startup on the font
  // download (a hang here would look like "the app won't open"). On error the
  // app falls back to the system font.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#15130f' }} />;
  }

  return (
    <Provider store={store}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </Provider>
  );
}
