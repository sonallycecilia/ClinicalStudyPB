import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardScaffold } from '../components/DashboardScaffold';
import { Icon, type IconName } from '../components/Icon';
import { VisitBadge } from '../components/VisitCard';
import { VisitStates } from '../components/VisitStates';
import { colors, shadows, useTypography } from '../ui/theme';
import { useVisits } from '../visits/VisitsContext';
import { visitDateLabels } from '../visits/participantVisitsApi';
import { visitsPath, visitActionPath } from '../visits/paths';

export default function VisitDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useVisits();
  const type = useTypography();
  const base = visitsPath;
  const visit = state.kind === 'success' ? state.visits.find(item => item.id === id) : undefined;
  const date = visit && visitDateLabels(visit.scheduledAt);
  function row(icon: IconName, label: string, value: string, subtitle?: string) {
    return <View style={styles.infoRow}>
      <View style={styles.icon}><Icon name={icon} color={colors.brand} /></View>
      <View style={styles.grow}><Text style={[styles.label, type.bold]}>{label}</Text><Text style={[styles.value, type.extraBold]}>{value}</Text>
        {!!subtitle && <Text style={[styles.subtitle, type.regular]}>{subtitle}</Text>}</View>
    </View>;
  }
  return <DashboardScaffold activeTab="visits">
    <View style={styles.heading}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar para visitas" onPress={() => router.canGoBack() ? router.back() : router.replace(base)} style={styles.back}><Icon name="arrowLeft" color={colors.ink} /></Pressable>
      <View style={styles.grow}><Text style={[styles.eyebrow, type.extraBold]}>SUA AGENDA</Text><Text accessibilityRole="header" style={[styles.headingText, type.extraBold]}>Detalhes da Visita</Text></View>
    </View>
    {!visit || !date ? <VisitStates missing /> : <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.studyRow}><Text style={[styles.study, type.extraBold]}>{visit.studyTitle}</Text><VisitBadge status={visit.status} /></View>
          <Text style={[styles.name, type.extraBold]}>{visit.plannedVisitName}</Text>
          <View style={styles.code}><Text style={[styles.codeText, type.extraBold]}>{visit.code ? `Código ${visit.code}` : `Visita ${String(visit.plannedVisitOrder).padStart(2, '0')}`}</Text></View>
        </View>
        <View style={styles.info}>
          {row('calendar', 'DATA', `${date.date} · ${date.day}`)}<View style={styles.line} />
          {row('clock', 'HORÁRIO', date.time)}<View style={styles.line} />
          {row('location', 'LOCAL', visit.location ?? 'Local a informar', visit.address)}
        </View>
      </View>
      {!!visit.preparation && <View style={styles.preparation}>
        <View style={[styles.icon, { backgroundColor: colors.white }]}><Icon name="alert" color={colors.preparationDark} /></View>
        <View style={styles.grow}><Text style={[styles.eyebrow, { color: colors.preparationDark }, type.extraBold]}>INSTRUÇÕES DE PREPARO</Text>
          <Text style={[styles.preparationText, type.extraBold]}>{visit.preparation}</Text>
          <Text style={[styles.subtitle, type.regular]}>Chegue com 15 minutos de antecedência e leve um documento com foto.</Text></View>
      </View>}
      {visit.status === 'Agendada' && <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => router.push(visitActionPath(visit.id, 'confirmar'))} style={[styles.button, styles.confirm]}><Text style={[styles.buttonText, type.extraBold]}>Confirmar presença</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(visitActionPath(visit.id, 'reagendar'))} style={[styles.button, styles.reschedule]}><Text style={[styles.buttonText, { color: colors.brand }, type.extraBold]}>Solicitar reagendamento</Text></Pressable>
        <Text style={[styles.development, type.medium]}>Funcionalidade em desenvolvimento</Text>
      </View>}
    </>}
  </DashboardScaffold>;
}
const styles = StyleSheet.create({
  grow: { flex: 1 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  back: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.brand, fontSize: 11, letterSpacing: 1.54 }, headingText: { fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  card: { borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, overflow: 'hidden', boxShadow: shadows.card },
  cardHeader: { padding: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  studyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, study: { flex: 1, fontSize: 11, lineHeight: 18, letterSpacing: 1.32, textTransform: 'uppercase', color: colors.brand },
  name: { marginTop: 12, fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.ink },
  code: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 4 },
  codeText: { fontSize: 11, color: colors.muted, letterSpacing: 1 },
  info: { padding: 20, gap: 20 }, infoRow: { flexDirection: 'row', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, color: colors.placeholder, letterSpacing: 1 }, value: { fontSize: 14, color: colors.ink, marginTop: 4, lineHeight: 22 },
  subtitle: { fontSize: 12, lineHeight: 20, color: colors.muted, marginTop: 4 }, line: { height: 1, backgroundColor: colors.line },
  preparation: { flexDirection: 'row', gap: 12, borderRadius: 20, padding: 20, marginTop: 16, borderWidth: 1, borderColor: colors.preparationLine, backgroundColor: colors.preparation },
  preparationText: { marginTop: 8, fontSize: 14, lineHeight: 24, color: colors.ink }, actions: { marginTop: 20, gap: 12 },
  button: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  confirm: { backgroundColor: colors.success, boxShadow: '0px 12px 28px -12px rgba(22,120,74,0.55)' },
  reschedule: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.brand }, buttonText: { fontSize: 14, color: colors.white, textAlign: 'center' },
  development: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
