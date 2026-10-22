import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DEFAULT_AI_MODEL, listModels, type ModelInfo } from '@/lib/ai/smileGen';
import { saveSettings, type Settings } from '@/lib/storage/settings';
import { colors, radius } from '@/theme';

/** Chave e modelo da IA do Google (ficam só neste aparelho). */
export function AiConfig({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [listing, setListing] = useState(false);

  const save = async () => {
    await saveSettings({ aiApiKey: (keyDraft ?? settings.aiApiKey).trim(), aiModel: (modelDraft ?? settings.aiModel).trim() || DEFAULT_AI_MODEL });
    onSaved();
    Alert.alert('Salvo', 'A chave fica guardada só neste aparelho.');
  };
  const check = async () => {
    const key = (keyDraft ?? settings.aiApiKey).trim();
    if (!key) {
      Alert.alert('Falta a chave', 'Cole a chave da API primeiro.');
      return;
    }
    setListing(true);
    try {
      setModels(await listModels(key));
    } catch (e) {
      Alert.alert('Não foi possível listar os modelos', String((e as Error).message ?? e));
    } finally {
      setListing(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Serviço de IA (Google Gemini)</SectionTitle>
      <Muted>
        {`Chave criada em aistudio.google.com (Get API key). Fica guardada só neste aparelho. Modelo padrão: ${DEFAULT_AI_MODEL} (Nano Banana 2 Lite, o mais barato).`}
      </Muted>
      <TextInput
        placeholder="Chave da API"
        value={keyDraft ?? settings.aiApiKey}
        onChangeText={setKeyDraft}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholderTextColor={colors.muted}
      />
      <TextInput
        placeholder="Modelo"
        value={modelDraft ?? settings.aiModel}
        onChangeText={setModelDraft}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
      />
      <View style={styles.row}>
        <Button title="Salvar" variant="secondary" onPress={save} />
        <Button title={listing ? 'Consultando…' : 'Ver modelos da chave'} variant="ghost" onPress={check} loading={listing} />
      </View>
      {models && (
        <>
          <Muted>
            {models.some((m) => m.image) ? 'Modelos de imagem desta chave (toque para usar):' : 'A chave funciona, mas nenhum modelo de imagem apareceu.'}
          </Muted>
          <View style={styles.chips}>
            {models
              .filter((m) => m.image)
              .map((m) => (
                <Chip key={m.name} label={m.name} selected={(modelDraft ?? settings.aiModel) === m.name} onPress={() => setModelDraft(m.name)} />
              ))}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: 10,
    color: colors.text,
    backgroundColor: '#FBFCFE',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
