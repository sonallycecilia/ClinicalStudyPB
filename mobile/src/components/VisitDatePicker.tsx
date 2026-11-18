import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, useTypography } from '../ui/theme';
import { Icon } from './Icon';

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function calendarCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(firstDay).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function VisitDatePicker({ value, onChange, today = new Date() }: { value: string; onChange: (date: string) => void; today?: Date }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const type = useTypography();
  const min = localDateKey(today);
  const display = value ? value.split('-').reverse().join('/') : 'dd/mm/aaaa';
  function shift(offset: number) { setMonth(current => new Date(current.getFullYear(), current.getMonth() + offset, 1)); }
  function show() {
    const date = value ? new Date(`${value}T12:00:00`) : today;
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(true);
  }
  const previousDisabled = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Preferência de nova data, ${display}`} onPress={show} style={styles.field}>
      <Text style={[styles.fieldText, type.regular, !value && { color: colors.placeholder }]}>{display}</Text><Icon name="calendar" size={18} color={colors.brand} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View accessibilityViewIsModal style={styles.calendar}>
            <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>Preferência de nova data</Text>
            <View style={styles.monthRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" accessibilityState={{ disabled: previousDisabled }} disabled={previousDisabled} onPress={() => shift(-1)} style={[styles.arrow, previousDisabled && { opacity: 0.3 }]}><Icon name="arrowLeft" color={colors.brand} /></Pressable>
              <Text accessibilityLiveRegion="polite" style={[styles.month, type.bold]}>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => shift(1)} style={styles.arrow}><Icon name="chevron" color={colors.brand} /></Pressable>
            </View>
            <View style={styles.grid}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <View key={index} style={styles.cell}><Text style={[styles.weekday, type.bold]}>{day}</Text></View>)}</View>
            <View style={styles.grid}>
              {calendarCells(month.getFullYear(), month.getMonth()).map((day, index) => {
                if (!day) return <View key={`blank-${index}`} style={styles.cell} />;
                const key = localDateKey(new Date(month.getFullYear(), month.getMonth(), day));
                const disabled = key < min;
                return <View key={key} style={styles.cell}><Pressable accessibilityRole="button" accessibilityLabel={`Selecionar ${new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR')}`}
                  accessibilityState={{ selected: key === value, disabled }} disabled={disabled}
                  onPress={() => { onChange(key); setOpen(false); }} style={[styles.day, key === min && styles.today, key === value && styles.selected]}>
                  <Text style={[styles.dayText, type.medium, disabled && { color: colors.placeholder }, key === value && { color: colors.white }]}>{day}</Text>
                </Pressable></View>;
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}><Text style={[styles.fieldText, { color: colors.brand }, type.bold]}>Fechar calendário</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  field: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldText: { fontSize: 14, color: colors.ink },
  overlay: { flex: 1, backgroundColor: 'rgba(21,53,50,0.35)' }, modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  calendar: { width: '100%', maxWidth: 390, backgroundColor: colors.white, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.line },
  title: { fontSize: 16, color: colors.ink, marginBottom: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  month: { fontSize: 14, color: colors.ink, textTransform: 'capitalize', flexShrink: 1 }, arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285714%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 12, color: colors.muted }, day: { width: '100%', minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  dayText: { fontSize: 14, color: colors.ink }, selected: { backgroundColor: colors.brand }, today: { borderColor: colors.brandSoft }, close: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
