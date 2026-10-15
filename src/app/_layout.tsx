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
        }}
      >
        <Stack.Screen name="index" options={{ title: 'ShadeLab' }} />
        <Stack.Screen name="shade/capture" options={{ title: 'Tirar cor', headerShown: false }} />
        <Stack.Screen name="shade/analyze" options={{ title: 'Análise de cor' }} />
        <Stack.Screen name="cases/index" options={{ title: 'Casos' }} />
        <Stack.Screen name="cases/[id]" options={{ title: 'Caso' }} />
        <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
        <Stack.Screen name="smile/index" options={{ title: 'Smile Design' }} />
        <Stack.Screen name="smile/ai" options={{ title: 'Sorriso por IA' }} />
      </Stack>
    </>
  );
}
