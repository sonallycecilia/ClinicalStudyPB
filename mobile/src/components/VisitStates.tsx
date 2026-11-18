import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows, useTypography } from '../ui/theme';
import { useVisits } from '../visits/VisitsContext';
import { Icon } from './Icon';

export function VisitStates({ missing = false }: { missing?: boolean }) {
  const { state, scope, retry } = useVisits();
  const type = useTypography();
  return <View style={styles.card}>
    {state.kind === 'loading' ? <View accessibilityLabel="Carregando visitas" accessibilityRole="progressbar"><ActivityIndicator color={colors.brand} /></View>
      : <View style={styles.icon}><Icon name={state.kind === 'error' ? 'alert' : 'calendar'} size={24} color={colors.brand} /></View>}
    <Text accessibilityRole={state.kind === 'error' ? 'alert' : undefined} style={[styles.text, type.bold]}>
      {state.kind === 'loading' ? 'Carregando visitas…' : state.kind === 'error' ? state.message : missing ? 'Visita não encontrada nesta agenda.'
        : scope === 'upcoming' ? 'Você não tem próximas visitas agendadas.' : 'Seu histórico de comparecimento ainda está vazio.'}
    </Text>
    {state.kind === 'error' && <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={[styles.buttonText, type.extraBold]}>Tentar novamente</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  card: { alignItems: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 20, paddingVertical: 40, boxShadow: shadows.card },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 16, maxWidth: 320, fontSize: 14, lineHeight: 24, textAlign: 'center', color: colors.muted },
  button: { minHeight: 44, marginTop: 16, padding: 12, backgroundColor: colors.brand, borderRadius: 12 },
  buttonText: { color: colors.white, fontSize: 14 },
});
