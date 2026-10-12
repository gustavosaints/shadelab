import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, type Settings } from '@/lib/storage/settings';

/** Recarrega as configurações sempre que a tela ganha foco. */
export function useSettings(): [Settings, () => Promise<void>] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const reload = useCallback(async () => setSettings(await loadSettings()), []);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return [settings, reload];
}
