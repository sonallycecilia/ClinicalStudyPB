import { useState, type ReactNode } from 'react';
import { router, usePathname } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, layout, shadows, useTypography } from '../ui/theme';
import { Brand } from './Brand';
import { Icon, type IconName } from './Icon';

export type DashboardTab = 'studies' | 'visits' | 'profile';
const tabs: { id: DashboardTab; label: string; icon: IconName }[] = [
  { id: 'studies', label: 'Estudos', icon: 'studies' },
  { id: 'visits', label: 'Visitas', icon: 'visits' },
  { id: 'profile', label: 'Perfil', icon: 'profile' },
];

export function dashboardPath(tab: DashboardTab) {
  return tab === 'studies' ? '/' : tab === 'visits' ? '/visitas' : '/perfil';
}

export function DashboardScaffold({ activeTab, children }: { activeTab: DashboardTab; children: ReactNode }) {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const [notice, setNotice] = useState(false);
  const type = useTypography();
  if (status !== 'authenticated' || user?.role !== 'Participante' || user.status !== 'Ativo') return null;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(name => name[0]).join('').toLocaleUpperCase('pt-BR');
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key={pathname} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.page}>
            <SafeAreaView edges={['top']} style={styles.header}>
              <View pointerEvents="none" style={styles.decoration} />
              <View style={styles.headerContent}>
                <View style={styles.row}>
                  <Brand compact />
                  <View style={styles.headerActions}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Notificações" onPress={() => setNotice(value => !value)} style={styles.bell}>
                      <Icon name="bell" color={colors.ink} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => router.replace(dashboardPath('profile'))} style={styles.avatar}>
                      <Text maxFontSizeMultiplier={1.5} style={[styles.initials, type.extraBold]}>{initials}</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.greeting}>
                  <Text style={[styles.date, type.semibold]}>{today.charAt(0).toUpperCase() + today.slice(1)}</Text>
                  <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>Olá, {user.name.trim().split(/\s+/)[0]}</Text>
                  <Text style={[styles.subtitle, type.regular]}>É bom ter você por aqui.</Text>
                </View>
                {notice && <Text accessibilityLiveRegion="polite" style={[styles.notice, type.medium]}>Funcionalidade em desenvolvimento</Text>}
              </View>
            </SafeAreaView>
            <View style={styles.body}>{children}</View>
          </View>
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={styles.navSafe}>
          <View accessibilityLabel="Navegação principal" style={styles.nav}>
            {tabs.map(tab => (
              <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: activeTab === tab.id }}
                onPress={() => router.replace(dashboardPath(tab.id))} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
                {activeTab === tab.id && <View style={styles.activeLine} />}
                <Icon name={tab.icon} size={21} color={activeTab === tab.id ? colors.brand : colors.muted} />
                <Text style={[styles.tabText, type.bold, activeTab === tab.id && { color: colors.brand }]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 24 },
  page: { width: '100%', maxWidth: layout.maxWidth },
  header: { backgroundColor: colors.white, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', boxShadow: shadows.header },
  decoration: { position: 'absolute', right: -80, top: -112, width: 256, height: 256, borderRadius: 128, backgroundColor: colors.brandPale, opacity: 0.7 },
  headerContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bell: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.avatar, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, color: colors.brandDark },
  greeting: { marginTop: 32 },
  date: { color: colors.muted, fontSize: 14 },
  title: { fontSize: 28, color: colors.ink, letterSpacing: -0.98, lineHeight: 36, marginTop: 4 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 22 },
  notice: { fontSize: 12, color: colors.muted, marginTop: 12 },
  body: { paddingHorizontal: 20, paddingTop: 28 },
  navSafe: { backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center' },
  nav: { width: '100%', maxWidth: layout.maxWidth, flexDirection: 'row', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12 },
  tabText: { fontSize: 11, color: colors.muted },
  activeLine: { position: 'absolute', top: -10, width: 28, height: 2, borderRadius: 2, backgroundColor: colors.brand },
  pressed: { backgroundColor: colors.surface },
});
