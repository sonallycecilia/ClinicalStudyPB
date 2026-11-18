import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DashboardScaffold } from '../components/DashboardScaffold';
import { Icon } from '../components/Icon';
import { VisitDatePicker } from '../components/VisitDatePicker';
import { VisitStates } from '../components/VisitStates';
import { colors, shadows, useTypography } from '../ui/theme';
import { useVisits } from '../visits/VisitsContext';
import { visitDateLabels } from '../visits/participantVisitsApi';
import { visitsPath, visitPath } from '../visits/paths';

export default function VisitActionScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action: string }>();
  const { state } = useVisits();
  const [date, setDate] = useState('');
  const [period, setPeriod] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(false);
  const [focused, setFocused] = useState(false);
  const type = useTypography();
  const visit = state.kind === 'success' ? state.visits.find(item => item.id === id) : undefined;
  const isReschedule = action === 'reagendar';
  const valid = visit?.status === 'Agendada' && (isReschedule || action === 'confirmar');
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(visit ? visitPath(visit.id) : visitsPath);
  };
  const labels = visit && visitDateLabels(visit.scheduledAt);
  return <DashboardScaffold activeTab="visits">
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar aos detalhes" onPress={back} style={styles.back}><Icon name="arrowLeft" size={16} color={colors.brand} /><Text style={[styles.backText, type.extraBold]}>Voltar</Text></Pressable>
    {!visit || !labels || !valid ? <VisitStates missing /> : <>
      <View style={styles.card}>
        <Text style={[styles.eyebrow, type.extraBold]}>{isReschedule ? 'SOLICITAR REAGENDAMENTO' : 'CONFIRMAR PRESENÇA'}</Text>
        <Text accessibilityRole="header" style={[styles.name, type.extraBold]}>{visit.plannedVisitName}</Text>
        <Text style={[styles.study, type.bold]}>{visit.studyTitle}</Text>
        <View style={styles.info}>
          <View style={styles.row}><Icon name="calendar" size={16} color={colors.brand} /><Text style={[styles.text, type.regular]}>{labels.date} · {labels.day}</Text></View>
          <View style={styles.row}><Icon name="clock" size={16} color={colors.brand} /><Text style={[styles.text, type.regular]}>{labels.time}</Text></View>
          <View style={styles.row}><Icon name="location" size={16} color={colors.brand} /><Text style={[styles.text, type.regular]}>{visit.location ?? 'Local a informar'}</Text></View>
        </View>
      </View>
      <Text style={[styles.explanation, type.regular]}>{isReschedule ? 'A equipe avaliará a solicitação. A visita atual permanece válida até a confirmação de uma nova data.' : 'A confirmação indica sua intenção de comparecer a esta visita.'}</Text>
      {isReschedule && <View style={styles.fields}>
        <View style={styles.fieldGroup}><Text style={[styles.label, type.bold]}>Preferência de nova data</Text><VisitDatePicker value={date} onChange={setDate} /></View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, type.bold]}>Período</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Período, ${period || 'Selecione'}`} accessibilityState={{ expanded: periodOpen }} onPress={() => setPeriodOpen(value => !value)} style={styles.select}>
            <Text style={[styles.label, type.regular]}>{period || 'Selecione'}</Text><View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chevron" size={16} /></View>
          </Pressable>
          {periodOpen && <View style={styles.options}>{['Manhã', 'Tarde'].map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: period === option }} onPress={() => { setPeriod(option); setPeriodOpen(false); }} style={[styles.option, period === option && { backgroundColor: colors.brandPale }]}><Text style={[styles.label, type.medium]}>{option}</Text></Pressable>)}</View>}
        </View>
        <View style={styles.fieldGroup}><Text style={[styles.label, type.bold]}>Motivo opcional</Text>
          <TextInput accessibilityLabel="Motivo opcional" value={reason} onChangeText={setReason} multiline numberOfLines={4} textAlignVertical="top"
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.reason, type.regular, focused && { borderColor: colors.brand }]} />
        </View>
      </View>}
      <Text accessibilityLiveRegion="polite" style={[styles.development, type.medium, notice && { color: colors.brandDark }]}>Funcionalidade em desenvolvimento{notice ? '. Nenhuma solicitação foi enviada.' : ''}</Text>
      <Pressable accessibilityRole="button" onPress={() => setNotice(true)} style={({ pressed }) => [styles.submit, pressed && { opacity: 0.8 }]}>
        <Text style={[styles.submitText, type.extraBold]}>{isReschedule ? 'Enviar solicitação' : 'Confirmar presença'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={back} style={styles.cancel}><Text style={[styles.text, type.bold]}>Voltar</Text></Pressable>
    </>}
  </DashboardScaffold>;
}
const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20 }, backText: { fontSize: 14, color: colors.brand },
  card: { borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 20, boxShadow: shadows.card },
  eyebrow: { fontSize: 11, color: colors.brand, letterSpacing: 1.32 }, name: { marginTop: 8, fontSize: 20, lineHeight: 28, color: colors.ink }, study: { marginTop: 4, fontSize: 12, lineHeight: 20, color: colors.muted },
  info: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line, gap: 8 }, row: { flexDirection: 'row', gap: 8 }, text: { fontSize: 14, color: colors.muted, flexShrink: 1, lineHeight: 20 },
  explanation: { marginTop: 20, fontSize: 14, lineHeight: 24, color: colors.muted }, fields: { marginTop: 20, gap: 16 }, fieldGroup: { gap: 8 }, label: { fontSize: 14, color: colors.ink },
  select: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  options: { borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }, option: { minHeight: 48, padding: 12, justifyContent: 'center' },
  reason: { minHeight: 112, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, padding: 12, color: colors.ink, fontSize: 14 },
  development: { marginTop: 20, fontSize: 12, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  submit: { minHeight: 56, marginTop: 20, borderRadius: 16, backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', boxShadow: shadows.button }, submitText: { fontSize: 14, color: colors.white },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
