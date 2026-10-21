import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { labToHex } from '@/lib/color/convert';
import { GINGIVA_SYSTEM } from '@/lib/color/gingiva';
import { getSystem, SHADE_SYSTEMS, type ShadeSystemId } from '@/lib/color/shades';
import { clearCalibration, clearGingivaCalibration, saveSettings } from '@/lib/storage/settings';
import { useSettings } from '@/lib/useSettings';
import { colors, radius, spacing } from '@/theme';

export default function Settings() {
  const [settings, reload] = useSettings();
  const [clinic, setClinic] = useState<string | null>(null);
  const [dentist, setDentist] = useState<string | null>(null);
  const system = getSystem(settings.shadeSystem);
  const calib = settings.calibrations[settings.shadeSystem] ?? {};
  const done = system.shades.filter((s) => calib[s.id]).length;
  const gcalib = settings.gingivaCalibrations ?? {};
  const gdone = GINGIVA_SYSTEM.shades.filter((s) => gcalib[s.id]).length;

  const setSystem = async (id: ShadeSystemId) => {
    await saveSettings({ shadeSystem: id, referenceTab: SHADE_SYSTEMS[id].shades[1]?.id ?? '' });
    reload();
  };

  const saveIdentity = async () => {
    await saveSettings({
      clinicName: clinic ?? settings.clinicName,
      dentistName: dentist ?? settings.dentistName,
    });
    reload();
    Alert.alert('Salvo');
  };

  const reset = () =>
    Alert.alert('Limpar calibração', `Apagar as medições da ${system.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: async () => {
          await clearCalibration(settings.shadeSystem);
          reload();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
      <Card>
        <SectionTitle>Escala de cor</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Object.values(SHADE_SYSTEMS).map((s) => (
            <Chip key={s.id} label={s.name} selected={settings.shadeSystem === s.id} onPress={() => setSystem(s.id)} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>{`Calibrar minha escala · ${done}/${system.shades.length}`}</SectionTitle>
        <Muted>
          Fotografe cada tab da sua escala física com a mesma referência (cartão cinza) e a mesma luz que usa
          na clínica. Com todos os tabs medidos, a comparação passa a usar a cor real da sua escala no seu
          aparelho, em vez de valores médios de catálogo.
        </Muted>
        <View style={styles.grid}>
          {system.shades.map((s) => {
            const m = calib[s.id];
            return (
              <Pressable
                key={s.id}
                onPress={() =>
                  router.push({ pathname: '/shade/capture', params: { mode: 'calibrate', shade: s.id } })
                }
                style={[styles.tab, m && styles.tabDone]}
              >
                <View style={[styles.tabSwatch, { backgroundColor: labToHex(m ?? s.lab) }]} />
                <Text style={styles.tabId}>{s.id}</Text>
                <Text style={[styles.tabStatus, m && { color: colors.accent }]}>{m ? 'medido' : 'medir'}</Text>
              </Pressable>
            );
          })}
        </View>
        {done > 0 && <Button title="Limpar calibração" variant="ghost" onPress={reset} />}
      </Card>

      <Card>
        <SectionTitle>{`Calibrar escala de gengiva · ${gdone}/${GINGIVA_SYSTEM.shades.length}`}</SectionTitle>
        <Muted>
          {GINGIVA_SYSTEM.name}. Os valores de fábrica são aproximados: fotografe cada tab de gengiva com a mesma referência e
          luz. A foto do tab fica guardada e aparece no PDF ao lado da gengiva do paciente.
        </Muted>
        <View style={styles.grid}>
          {GINGIVA_SYSTEM.shades.map((s) => {
            const m = gcalib[s.id];
            return (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/shade/capture', params: { mode: 'calibrate-gingiva', shade: s.id } })}
                style={[styles.tab, m && styles.tabDone]}
              >
                <View style={[styles.tabSwatch, { backgroundColor: labToHex(m ?? s.lab) }]} />
                <Text style={styles.tabId}>{s.id}</Text>
                <Text style={[styles.tabStatus, m && { color: colors.accent }]}>{m ? 'medido' : 'medir'}</Text>
              </Pressable>
            );
          })}
        </View>
        {gdone > 0 && (
          <Button
            title="Limpar calibração da gengiva"
            variant="ghost"
            onPress={async () => {
              await clearGingivaCalibration();
              reload();
            }}
          />
        )}
      </Card>

      <Card>
        <SectionTitle>Identificação no PDF</SectionTitle>
        <TextInput
          placeholder="Nome da clínica"
          value={clinic ?? settings.clinicName}
          onChangeText={setClinic}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          placeholder="Nome do profissional"
          value={dentist ?? settings.dentistName}
          onChangeText={setDentist}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        <Button title="Salvar" variant="secondary" onPress={saveIdentity} />
      </Card>

      <Card>
        <SectionTitle>Sobre a medição</SectionTitle>
        <Muted>
          A cor é lida da foto em RGB linear, descartando reflexos e sombras, corrigida pela referência e
          convertida para CIELAB (D65). A comparação usa ΔE00 (CIEDE2000). Os valores padrão das escalas são
          médias da literatura e podem diferir da sua escala física: calibre para maior precisão.
        </Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 8 },
  tab: {
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FBFCFE',
  },
  tabDone: { borderColor: colors.accent, backgroundColor: '#F0FBF7' },
  tabSwatch: { width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  tabId: { fontWeight: '700', color: colors.text, marginTop: 4 },
  tabStatus: { fontSize: 11, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
    color: colors.text,
    backgroundColor: '#FBFCFE',
  },
});
