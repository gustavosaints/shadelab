import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { buildShadeReportHtml } from '@/lib/report/shadeReport';
import type { ShadeCase } from '@/lib/storage/cases';
import { loadSettings } from '@/lib/storage/settings';

/** Gera o PDF do caso de cor e abre o menu de compartilhar (WhatsApp, e-mail, laboratório…). */
export async function shareShadeCasePdf(c: ShadeCase): Promise<void> {
  try {
    const s = await loadSettings();
    const html = await buildShadeReportHtml(c, s);
    const { uri } = await Print.printToFileAsync({ html });
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } else {
      Alert.alert('PDF gerado', uri);
    }
  } catch (e) {
    Alert.alert('Erro ao exportar', String(e));
  }
}
