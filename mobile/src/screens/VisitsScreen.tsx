import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashboardScaffold } from '../components/DashboardScaffold';
import { VisitCard } from '../components/VisitCard';
import { VisitStates } from '../components/VisitStates';
import { colors, shadows, useTypography } from '../ui/theme';
import { useVisits } from '../visits/VisitsContext';
import type { VisitScope } from '../visits/participantVisitsApi';
import { visitPath } from '../visits/paths';

export default function VisitsScreen() {
  const { state, scope, setScope } = useVisits();
  const type = useTypography();
  return <DashboardScaffold activeTab="visits">
    <Text style={[styles.eyebrow, type.extraBold]}>SUA AGENDA</Text>
    <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>Visitas</Text>
    <View accessibilityRole="tablist" accessibilityLabel="Filtrar visitas" style={styles.tabs}>
      {([{ id: 'upcoming', label: 'Próximas visitas' }, { id: 'history', label: 'Histórico' }] as const).map(tab => (
        <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: scope === tab.id }} onPress={() => setScope(tab.id as VisitScope)}
          style={[styles.tab, scope === tab.id && styles.active]}>
          <Text style={[styles.tabText, type.extraBold, scope === tab.id && { color: colors.white }]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
    <View style={styles.list}>
      {state.kind === 'success' && state.visits.length ? state.visits.map(visit => <VisitCard key={visit.id} visit={visit}
        onSelect={() => router.push(visitPath(visit.id))} />) : <VisitStates />}
    </View>
  </DashboardScaffold>;
}
const styles = StyleSheet.create({
  eyebrow: { fontSize: 12, letterSpacing: 1.68, color: colors.brand, marginBottom: 4 },
  title: { fontSize: 23, letterSpacing: -0.575, color: colors.ink, marginBottom: 20 },
  tabs: { flexDirection: 'row', padding: 6, borderRadius: 16, backgroundColor: colors.white, marginBottom: 20, boxShadow: shadows.card },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.brand, boxShadow: shadows.button }, tabText: { fontSize: 14, color: colors.muted },
  list: { gap: 16 },
});
