import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
          // sem "voltar" ao deslizar da borda: nas telas de edição (foto com zoom, quadros, alças) o gesto
          // disparava e jogava o usuário de volta ao início (pedido do Gustavo, 2026-10-21)
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'ShadeLab' }} />
        <Stack.Screen name="shade/capture" options={{ title: 'Tirar cor', headerShown: false }} />
        <Stack.Screen name="shade/analyze" options={{ title: 'Análise de cor' }} />
        <Stack.Screen name="cases/index" options={{ title: 'Casos' }} />
        <Stack.Screen name="cases/[id]" options={{ title: 'Caso' }} />
        <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
        <Stack.Screen name="smile/index" options={{ title: 'Smile Design' }} />
        <Stack.Screen name="smile/capture" options={{ title: 'Foto do sorriso', headerShown: false }} />
      </Stack>
    </>
  );
}
