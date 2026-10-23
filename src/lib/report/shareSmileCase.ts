import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import type { SmileCase } from '@/lib/storage/cases';

/** Abre o menu de compartilhar com a simulação do Smile Design (ou a foto, se o caso ainda não tem simulação). */
export async function shareSmileCaseImage(c: SmileCase): Promise<void> {
  const uri = c.renderedUri ?? c.photoUri;
  try {
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
    else Alert.alert('Imagem', uri);
  } catch (e) {
    Alert.alert('Não foi possível enviar', String(e));
  }
}
