import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { ConsentButton } from '../components/ConsentButton';
import { Icon } from '../components/Icon';
import { useConsent } from '../consent/ConsentContext';
import { colors, layout, useTypography } from '../ui/theme';

export default function FirstAccessScreen() {
  const { logout } = useAuth();
  const { accepted, continueToStudies } = useConsent();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();
  const titleSize = Math.min(34, Math.max(28, Math.min(width, layout.maxWidth) * 0.078));
  const type = useTypography();

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    setError('');
    try { await logout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível sair.'); }
    finally { setLeaving(false); }
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.page}>
        <View pointerEvents="none" accessible={false} style={styles.decoration} />
        <View style={styles.header}>
          <Brand compact />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: leaving }} disabled={leaving} onPress={() => void signOut()}
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
            <Text style={[styles.logoutText, type.extraBold]}>Sair</Text>
          </Pressable>
        </View>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, type.extraBold]}>PRIMEIRO ACESSO</Text>
          <Text accessibilityRole="header" style={[styles.title, type.extraBold, { fontSize: titleSize, lineHeight: titleSize * 1.15 }]}>
            Bem-vindo(a) ao{'\n'}<Text style={styles.brandTitle}>ClinicalStudyPB!</Text>
          </Text>
          <Text style={[styles.description, type.regular]}>Antes de acompanhar seus estudos clínicos, é importante conhecer seus direitos e responsabilidades como participante.</Text>
        </View>
        <View style={styles.footer}>
          {!accepted && <Text style={[styles.instruction, type.regular]}>Para continuar, leia e aceite o Termo de Consentimento e Compromisso do Participante.</Text>}
          <Pressable accessibilityRole="button" onPress={() => router.push('/termo-consentimento')}
            style={({ pressed }) => [styles.term, pressed && styles.termPressed]}>
            <View style={styles.termIcon}><Icon name={accepted ? 'shieldCheck' : 'studies'} size={18} color={colors.brandDark} /></View>
            <View style={styles.termContent}>
              <Text style={[styles.termTitle, type.extraBold]}>{accepted ? 'Termo de consentimento' : 'Visualizar termo de consentimento'}</Text>
              <View style={styles.termStatus}>
                {accepted && <Icon name="check" size={12} color={colors.brand} />}
                <Text style={[styles.statusText, type.semibold]}>{accepted ? 'Lido e aceito' : 'Pendente de leitura e aceite'}</Text>
              </View>
            </View>
            <Icon name="chevron" size={16} color={colors.brandDark} />
          </Pressable>
          <View style={styles.continue}><ConsentButton disabled={!accepted} onPress={continueToStudies}>Continuar</ConsentButton></View>
          {!!error && <Text accessibilityRole="alert" style={[styles.error, type.medium]}>{error}</Text>}
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white }, scroll: { flexGrow: 1, alignItems: 'center' },
  page: { flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, overflow: 'hidden' },
  decoration: { position: 'absolute', right: -112, top: -128, width: 288, height: 288, borderRadius: 144, backgroundColor: colors.brandPale, opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  logout: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  logoutText: { color: colors.brandDark, fontSize: 14, lineHeight: 20 }, pressed: { backgroundColor: colors.brandPale },
  intro: { paddingHorizontal: 24, paddingTop: 32 },
  eyebrow: { color: colors.brandDark, fontSize: 11, lineHeight: 16.5, letterSpacing: 1.76, marginBottom: 12 },
  title: { color: colors.ink, letterSpacing: -1.36 }, brandTitle: { color: colors.brandDark },
  description: { marginTop: 16, maxWidth: 310, fontSize: 15, lineHeight: 24, color: colors.muted },
  footer: { marginTop: 'auto', paddingHorizontal: 24, paddingBottom: 24, paddingTop: 48 },
  instruction: { fontSize: 14, lineHeight: 24, color: colors.muted, marginBottom: 16 },
  term: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12 },
  termPressed: { borderColor: colors.brandSoft, backgroundColor: colors.brandPale },
  termIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  termContent: { flex: 1 }, termTitle: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  termStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }, statusText: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  continue: { marginTop: 32 }, error: { color: colors.alert, fontSize: 14, lineHeight: 21, marginTop: 12 },
});
