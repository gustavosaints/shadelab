import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '@/theme';

type Props = { label: string; selected?: boolean; onPress?: () => void; color?: string };

export function Chip({ label, selected, onPress, color }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: color ?? colors.primary, borderColor: color ?? colors.primary },
      ]}
    >
      <Text style={[styles.text, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  text: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
