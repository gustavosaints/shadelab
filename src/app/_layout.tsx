import { Italiana_400Regular } from '@expo-google-fonts/italiana';
import { Jost_300Light, Jost_400Regular, Jost_500Medium } from '@expo-google-fonts/jost';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Intro } from '@/components/Intro';
import { LoginScreen } from '@/components/LoginScreen';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

/**
 * O app (rotas) fica sempre montado; por cima dele aparecem a abertura com a logomarca e, enquanto não houver
 * login, a tela de acesso. Assim, ao bloquear depois de um tempo em segundo plano, nada do que estava aberto se perde.
 */
function Root() {
  const [fontsLoaded] = useFonts({ Italiana_400Regular, Jost_300Light, Jost_400Regular, Jost_500Medium });
  const { status } = useAuth();
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  const ready = status !== 'checking';
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.medium, fontSize: 17 },
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
          // sem "voltar" ao deslizar da borda: nas telas de edição (foto com zoom, quadros, alças) o gesto
          // disparava e jogava o usuário de volta ao início (pedido do Gustavo, 2026-10-21)
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Cypris Smile', headerShown: false }} />
        <Stack.Screen name="shade/capture" options={{ title: 'Tirar cor', headerShown: false }} />
        <Stack.Screen name="shade/analyze" options={{ title: 'Análise de cor' }} />
        <Stack.Screen name="cases/index" options={{ title: 'Casos' }} />
        <Stack.Screen name="cases/[id]" options={{ title: 'Caso' }} />
        <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
        <Stack.Screen name="smile/index" options={{ title: 'Smile Design' }} />
        <Stack.Screen name="smile/capture" options={{ title: 'Foto do sorriso', headerShown: false }} />
      </Stack>
      {ready && introDone && status !== 'unlocked' && <LoginScreen />}
      {!introDone && <Intro ready={ready} onDone={finishIntro} />}
    </>
  );
}
