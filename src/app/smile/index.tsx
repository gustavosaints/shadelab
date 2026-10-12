import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/Button';
import { Card, Muted, SectionTitle } from '@/components/Card';
import { colors, spacing } from '@/theme';

export default function Smile() {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md }}>
      <Card>
        <SectionTitle>Smile Design · próximo módulo</SectionTitle>
        <Muted>
          Este módulo ainda não está disponível. O planejado para ele:
        </Muted>
        {[
          'Foto frontal do sorriso com guia de enquadramento',
          'Marcação da linha média, linha do sorriso e linha bipupilar',
          'Biblioteca de formatos de dentes (oval, quadrado, triangular) aplicada por proporção',
          'Ajuste de comprimento, largura e posição com arrasto',
          'Comparação antes e depois para mostrar ao paciente',
          'Exportação junto com o caso de cor',
        ].map((t) => (
          <Text key={t} style={styles.item}>
            • {t}
          </Text>
        ))}
      </Card>
      <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  item: { color: colors.text, lineHeight: 22, marginTop: 6 },
});
