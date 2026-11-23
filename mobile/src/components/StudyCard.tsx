import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ParticipantStudy, StudyStatus } from '../studies/participantStudiesApi';
import { colors, shadows, useTypography } from '../ui/theme';
import { Icon } from './Icon';

const labels: Record<StudyStatus, string> = {
  planejamento: 'Planejamento', recrutamento: 'Recrutamento', execução: 'Em execução', encerrado: 'Encerrado',
};
const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// E09 dates are civil dates. Do not parse them as UTC and shift the displayed day.
export function studyDateLabel(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

export function StudyBadge({ status }: { status: StudyStatus }) {
  const type = useTypography();
  return <View style={styles.badge}><View accessible={false} style={styles.dot} />
    <Text style={[styles.badgeText, type.extraBold]}>{labels[status]}</Text></View>;
}

export function StudyDates({ study }: { study: ParticipantStudy['study'] }) {
  const type = useTypography();
  return <View style={styles.dates}>
    <View style={styles.calendar}><Icon name="calendar" color={colors.brand} /></View>
    <View style={styles.date}><Text style={[styles.dateLabel, type.bold]}>INÍCIO</Text>
      <Text style={[styles.dateValue, type.extraBold]}>{studyDateLabel(study.startDate)}</Text></View>
    <View style={styles.date}><Text style={[styles.dateLabel, type.bold]}>TÉRMINO</Text>
      <Text style={[styles.dateValue, type.extraBold]}>{studyDateLabel(study.endDate)}</Text></View>
  </View>;
}

export function StudyWithdrawalPreview() {
  const [notice, setNotice] = useState(false);
  const type = useTypography();
  return <View style={styles.withdrawal}>
    <Pressable accessibilityRole="button" onPress={() => setNotice(true)} style={styles.withdrawalButton}>
      <Text style={[styles.withdrawalText, type.bold]}>Solicitar retirada do estudo</Text>
    </Pressable>
    {notice && <Text accessibilityLiveRegion="polite" style={[styles.notice, type.medium]}>Funcionalidade em desenvolvimento. Nenhuma solicitação foi enviada.</Text>}
  </View>;
}

export function StudyCard({ participation, onSelect }: { participation: ParticipantStudy; onSelect: () => void }) {
  const { study, participationStatus } = participation;
  const type = useTypography();
  return <View style={styles.card}>
    <View accessible={false} style={styles.accent} />
    <View style={styles.content}>
      <View style={styles.statusRow}><StudyBadge status={study.status} /></View>
      <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>{study.title}</Text>
      <Text numberOfLines={3} style={[styles.description, type.regular]}>{study.objective}</Text>
      <Text style={[styles.description, type.regular]}>Participação: {participationStatus}</Text>
      <View style={styles.period}><StudyDates study={study} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${study.title}`} onPress={onSelect}
        style={({ pressed }) => [styles.details, pressed && { backgroundColor: colors.brandPale }]}>
        <Text style={[styles.detailsText, type.extraBold]}>Ver detalhes</Text><Icon name="chevron" color={colors.brand} size={16} />
      </Pressable>
      {participationStatus === 'Ativo' && <StudyWithdrawalPreview />}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, boxShadow: shadows.card },
  accent: { width: 6, backgroundColor: colors.brand }, content: { flex: 1, padding: 20 },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.brandPale },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand }, badgeText: { fontSize: 11, color: colors.brandDark },
  title: { fontSize: 18, color: colors.ink, lineHeight: 25 }, description: { fontSize: 14, color: colors.muted, lineHeight: 22, marginTop: 8 },
  period: { marginTop: 20, borderTopWidth: 1, borderColor: colors.line, paddingTop: 16 },
  dates: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  calendar: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' },
  date: { flex: 1, minWidth: 90, gap: 4 }, dateLabel: { fontSize: 10, color: colors.placeholder }, dateValue: { fontSize: 12, color: colors.ink },
  details: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 16, marginTop: 20 },
  detailsText: { fontSize: 14, color: colors.brand }, withdrawal: { alignItems: 'center' },
  withdrawalButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, marginTop: 4 },
  withdrawalText: { fontSize: 12, color: colors.muted, textDecorationLine: 'underline', textAlign: 'center' },
  notice: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: 8 },
});
