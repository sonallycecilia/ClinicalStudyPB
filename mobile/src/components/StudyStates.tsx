import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StudiesState } from '../studies/useParticipantStudies';
import { colors, shadows, useTypography } from '../ui/theme';

export function StudyStates({ state, onRetry, missing = false }: { state: StudiesState; onRetry: () => void; missing?: boolean }) {
  const type = useTypography();
  if (state.kind === 'loading') return <View accessibilityLabel="Carregando estudos" accessibilityRole="progressbar" style={styles.loading}>
    <ActivityIndicator color={colors.brand} size="small" /><Text style={[styles.text, type.medium]}>Carregando estudos…</Text>
  </View>;
  return <View style={styles.card}>
    {state.kind === 'error' ? <>
      <Text accessibilityRole="alert" style={[styles.error, type.medium]}>{state.message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.8 }]}>
        <Text style={[styles.retryText, type.extraBold]}>Tentar novamente</Text>
      </Pressable>
    </> : <Text style={[styles.text, type.medium]}>{missing ? 'Estudo não encontrado entre as suas participações.' : 'Você ainda não participa de nenhum estudo.'}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  loading: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  card: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: colors.line, boxShadow: shadows.card },
  text: { fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center' },
  error: { color: colors.alert, backgroundColor: colors.alertPale, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 21, width: '100%', textAlign: 'center' },
  retry: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  retryText: { color: colors.white, fontSize: 14 },
});
