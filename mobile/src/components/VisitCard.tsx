import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows, useTypography } from '../ui/theme';
import { type Visit, type VisitStatus, visitDateLabels } from '../visits/participantVisitsApi';
import { Icon } from './Icon';

const badgeColors: Record<VisitStatus, { background: string; foreground: string }> = {
  Agendada: { background: colors.brandPale, foreground: colors.brand },
  Realizada: { background: colors.successSoft, foreground: colors.success },
  Ausente: { background: colors.alertPale, foreground: colors.alertDark },
  Cancelada: { background: colors.canvas, foreground: colors.muted },
};
export function VisitBadge({ status }: { status: VisitStatus }) {
  const type = useTypography();
  const palette = badgeColors[status];
  return <View style={[styles.badge, { backgroundColor: palette.background }]}>
    <View style={[styles.dot, { backgroundColor: palette.foreground }]} />
    <Text style={[styles.badgeText, type.extraBold, { color: palette.foreground }]}>{status}</Text>
  </View>;
}

export function VisitCard({ visit, onSelect }: { visit: Visit; onSelect: () => void }) {
  const type = useTypography();
  const date = visitDateLabels(visit.scheduledAt);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${visit.plannedVisitName}`} onPress={onSelect}
    style={({ pressed }) => [styles.card, pressed && { borderColor: colors.brandSoft, backgroundColor: colors.surface }]}>
    <View style={styles.top}><View style={styles.icon}><Icon name="calendar" color={colors.brand} /></View><VisitBadge status={visit.status} /></View>
    <Text style={[styles.study, type.extraBold]}>{visit.studyTitle}</Text>
    <Text style={[styles.title, type.extraBold]}>{visit.plannedVisitName}</Text>
    <View style={styles.info}>
      <View style={styles.row}><Icon name="calendar" size={16} color={colors.brand} />
        <Text style={[styles.text, type.regular]}><Text style={[{ color: colors.ink }, type.bold]}>{date.date}</Text><Text style={styles.separator}> · </Text>{date.day}<Text style={styles.separator}> · </Text>{date.time}</Text>
      </View>
      <View style={styles.row}><Icon name="location" size={16} color={colors.brand} /><Text style={[styles.text, styles.grow, type.regular]}>{visit.location ?? 'Local a informar'}</Text><Icon name="chevron" size={16} color={colors.placeholder} /></View>
      {visit.status === 'Agendada' && !!visit.preparation && <View style={styles.preparation}><Icon name="alert" size={16} color={colors.preparationDark} /><Text style={[styles.text, styles.grow, { color: colors.ink }, type.regular]}>{visit.preparation}</Text></View>}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 20, boxShadow: shadows.card },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 16, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 30, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 11 }, dot: { width: 6, height: 6, borderRadius: 3 },
  study: { fontSize: 11, lineHeight: 20, letterSpacing: 1.1, color: colors.brand, textTransform: 'uppercase', marginTop: 16 },
  title: { fontSize: 16, lineHeight: 24, letterSpacing: -0.24, color: colors.ink, marginTop: 8 },
  info: { borderTopWidth: 1, borderColor: colors.line, marginTop: 16, paddingTop: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  text: { fontSize: 14, lineHeight: 20, color: colors.muted, flexShrink: 1 }, grow: { flex: 1 },
  separator: { color: colors.line },
  preparation: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, backgroundColor: colors.preparation, paddingHorizontal: 12, paddingVertical: 10 },
});
