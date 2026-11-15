import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { colors, layout, shadows, useTypography } from '../ui/theme';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const type = useTypography();
  const names = user?.name.trim().split(/\s+/) ?? [];
  const initials = names.slice(0, 2).map(name => name[0]).join('').toLocaleUpperCase('pt-BR');
  async function signOut() {
    if (loading) return;
    setLoading(true);
    setError('');
    try { await logout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível sair.'); }
    finally { setLoading(false); }
  }
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.page}>
          <SafeAreaView edges={['top']} style={styles.header}>
            <View pointerEvents="none" accessible={false} style={styles.decoration} />
            <View style={styles.headerContent}>
              <View style={styles.headerRow}>
                <Brand compact />
                <View accessible={false} style={styles.headerAvatar}><Text maxFontSizeMultiplier={1.5} style={[styles.headerInitials, type.extraBold]}>{initials}</Text></View>
              </View>
              <View style={styles.greeting}>
                <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>Olá, {user?.name}!</Text>
                <Text style={[styles.subtitle, type.regular]}>É bom ter você por aqui.</Text>
              </View>
            </View>
          </SafeAreaView>
          <View style={styles.body}>
            <Text style={[styles.eyebrow, type.extraBold]}>SEU ACESSO</Text>
            <Text accessibilityRole="header" style={[styles.sectionTitle, type.extraBold]}>Minha conta</Text>
            <View style={styles.card}>
              <View accessible={false} style={styles.avatar}><Text maxFontSizeMultiplier={1.5} style={[styles.initials, type.extraBold]}>{initials}</Text></View>
              <Text style={[styles.name, type.extraBold]}>{user?.name}</Text>
              <Text style={[styles.email, type.regular]}>{user?.email}</Text>
              <View style={styles.badge}><Text style={[styles.role, type.bold]}>{user?.role}</Text></View>
              <View style={styles.notice}>
                <Text style={[styles.text, type.regular]}>Seu acesso foi realizado com sucesso. As funcionalidades de acompanhamento pelo aplicativo estarão disponíveis em breve.</Text>
              </View>
              {!!error && <Text accessibilityRole="alert" style={[styles.error, type.medium]}>{error}</Text>}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading}
                onPress={() => void signOut()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.dimmed]}>
                <Text style={[styles.buttonText, type.extraBold]}>{loading ? 'Saindo…' : 'Sair da conta'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, alignItems: 'center', paddingBottom: 24 },
  page: { width: '100%', maxWidth: layout.maxWidth },
  header: { backgroundColor: colors.white, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', boxShadow: shadows.header },
  decoration: { position: 'absolute', right: -80, top: -112, width: 256, height: 256, borderRadius: 128, backgroundColor: colors.brandPale, opacity: 0.7 },
  headerContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.avatar, alignItems: 'center', justifyContent: 'center' },
  headerInitials: { fontSize: 14, color: colors.brandDark },
  greeting: { marginTop: 32 },
  title: { fontSize: 28, color: colors.ink, letterSpacing: -0.98, lineHeight: 36 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 22 },
  body: { paddingHorizontal: 20, paddingTop: 28 },
  eyebrow: { fontSize: 12, color: colors.brand, letterSpacing: 1.68, marginBottom: 4 },
  sectionTitle: { fontSize: 23, color: colors.ink, letterSpacing: -0.575, marginBottom: 20 },
  card: { backgroundColor: colors.white, padding: 24, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', boxShadow: shadows.card },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.avatar, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, color: colors.brandDark },
  name: { fontSize: 20, color: colors.ink, textAlign: 'center', marginTop: 16 },
  email: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.brandPale, marginTop: 12 },
  role: { color: colors.brandDark, fontSize: 12 },
  notice: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 20, marginTop: 20, width: '100%' },
  text: { fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center' },
  error: { color: colors.alert, backgroundColor: colors.alertPale, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 21, width: '100%', marginTop: 16 },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', marginTop: 24, width: '100%' },
  pressed: { backgroundColor: colors.brandPale, borderColor: colors.brandSoft },
  dimmed: { opacity: 0.7 },
  buttonText: { color: colors.brand, fontSize: 14 },
});
