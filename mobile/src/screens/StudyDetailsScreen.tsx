import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardScaffold } from '../components/DashboardScaffold';
import { Icon } from '../components/Icon';
import { StudyBadge, StudyDates, StudyWithdrawalPreview } from '../components/StudyCard';
import { StudyStates } from '../components/StudyStates';
import { useParticipantStudies } from '../studies/useParticipantStudies';
import { colors, shadows, useTypography } from '../ui/theme';

export default function StudyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, retry } = useParticipantStudies();
  const type = useTypography();
  // Resolve only from E09, never from the administrative study endpoint or route data.
  const participation = state.kind === 'success' ? state.studies.find(item => item.study.id === id) : undefined;
  return <DashboardScaffold activeTab="studies">
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
      style={styles.back}><Icon name="arrowLeft" size={16} color={colors.brand} />
      <Text style={[styles.backText, type.extraBold]}>Voltar aos meus estudos</Text></Pressable>
    {!participation ? <StudyStates state={state} onRetry={retry} missing /> : <View style={styles.card}>
      <View accessible={false} style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.heading}><Text style={[styles.eyebrow, type.extraBold]}>DETALHES DO ESTUDO</Text><StudyBadge status={participation.study.status} /></View>
        <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>{participation.study.title}</Text>
        <Text style={[styles.description, type.regular]}>{participation.study.objective}</Text>
        <View style={styles.metadata}>
          <View style={styles.info}><Text style={[styles.label, type.bold]}>CÓDIGO DO ESTUDO</Text><Text style={[styles.value, type.extraBold]}>{participation.study.code}</Text></View>
          <View style={styles.info}><Text style={[styles.label, type.bold]}>PESQUISADOR RESPONSÁVEL</Text><Text style={[styles.value, type.extraBold]}>{participation.study.researcher}</Text></View>
        </View>
        <View style={styles.period}><StudyDates study={participation.study} /></View>
        <Text style={[styles.description, type.regular]}>Participação: {participation.participationStatus}</Text>
        {participation.participationStatus === 'Ativo' && <StudyWithdrawalPreview />}
      </View>
    </View>}
  </DashboardScaffold>;
}
const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 16, marginBottom: 24 },
  backText: { color: colors.brand, fontSize: 14 }, card: { borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, overflow: 'hidden', boxShadow: shadows.card },
  accent: { height: 6, backgroundColor: colors.brand }, content: { padding: 20 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  eyebrow: { color: colors.brand, fontSize: 11, letterSpacing: 1.32 }, title: { fontSize: 23, lineHeight: 32, color: colors.ink, marginTop: 20 },
  description: { fontSize: 14, lineHeight: 24, color: colors.muted, marginTop: 12 }, metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  info: { flexGrow: 1, flexBasis: '45%', minWidth: 120, borderRadius: 16, backgroundColor: colors.surface, padding: 16 },
  label: { fontSize: 10, color: colors.placeholder }, value: { fontSize: 12, lineHeight: 20, color: colors.ink, marginTop: 8 },
  period: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, marginTop: 24 },
});
