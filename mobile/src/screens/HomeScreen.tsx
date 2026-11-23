import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { DashboardScaffold } from '../components/DashboardScaffold';
import { StudyCard } from '../components/StudyCard';
import { StudyStates } from '../components/StudyStates';
import { useParticipantStudies } from '../studies/useParticipantStudies';
import { colors, shadows, useTypography } from '../ui/theme';

export default function HomeScreen({ profile = false }: { profile?: boolean }) {
  const { status, user, logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { state, retry } = useParticipantStudies(!profile);
  const type = useTypography();
  const participantActive = status === 'authenticated' && user?.role === 'Participante' && user.status === 'Ativo';
  const names = user?.name.trim().split(/\s+/) ?? [];
  const initials = names.slice(0, 2).map(name => name[0]).join('').toLocaleUpperCase('pt-BR');

  async function signOut() {
    if (logoutLoading) return;
    setLogoutLoading(true);
    setLogoutError('');
    try { await logout(); }
    catch (reason) { setLogoutError(reason instanceof Error ? reason.message : 'Não foi possível sair.'); }
    finally { setLogoutLoading(false); }
  }

  if (!participantActive || !user) return null;

  return (
    <DashboardScaffold activeTab={profile ? 'profile' : 'studies'}>
      {!profile && <>
            <Text style={[styles.eyebrow, type.extraBold]}>SEU ACOMPANHAMENTO</Text>
            <View style={styles.sectionHeading}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, styles.headingTitle, type.extraBold]}>Meus Estudos Clínicos</Text>
              {state.kind === 'success' && state.studies.length > 0 && <View style={styles.count}>
                <Text accessibilityLabel={`${state.studies.length} ${state.studies.length === 1 ? 'estudo' : 'estudos'}`} style={[styles.countText, type.extraBold]}>{state.studies.length}</Text>
              </View>}
            </View>
            {state.kind === 'success' && state.studies.length > 0 ? (
              <View style={styles.studyList}>
                {state.studies.map(participation => <StudyCard key={participation.participationId} participation={participation}
                  onSelect={() => router.push({ pathname: '/estudos/[id]', params: { id: participation.study.id } })} />)}
              </View>
            ) : <StudyStates state={state} onRetry={retry} />}
      </>}
      {profile && (
            <View style={styles.accountSection}>
              <Text style={[styles.eyebrow, type.extraBold]}>SEU ACESSO</Text>
              <Text accessibilityRole="header" style={[styles.sectionTitle, type.extraBold]}>Minha conta</Text>
              <View style={styles.accountCard}>
                <View accessible={false} style={styles.avatar}><Text maxFontSizeMultiplier={1.5} style={[styles.initials, type.extraBold]}>{initials}</Text></View>
                <Text style={[styles.name, type.extraBold]}>{user.name}</Text>
                <Text style={[styles.email, type.regular]}>{user.email}</Text>
                <View style={styles.badge}><Text style={[styles.role, type.bold]}>{user.role}</Text></View>
                {!!logoutError && <Text accessibilityRole="alert" style={[styles.error, type.medium]}>{logoutError}</Text>}
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: logoutLoading, busy: logoutLoading }} disabled={logoutLoading}
                  onPress={() => void signOut()} style={({ pressed }) => [styles.button, pressed && styles.pressed, logoutLoading && styles.dimmed]}>
                  <Text style={[styles.buttonText, type.extraBold]}>{logoutLoading ? 'Saindo…' : 'Sair da conta'}</Text>
                </Pressable>
              </View>
            </View>
      )}
    </DashboardScaffold>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 12, color: colors.brand, letterSpacing: 1.68, marginBottom: 4 },
  sectionTitle: { fontSize: 23, color: colors.ink, letterSpacing: -0.575, marginBottom: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  headingTitle: { flex: 1, marginBottom: 0 },
  count: { minWidth: 30, minHeight: 30, paddingHorizontal: 8, borderRadius: 15, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, color: colors.brand },
  studyList: { gap: 16 },
  accountSection: { },
  accountCard: { backgroundColor: colors.white, padding: 24, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', boxShadow: shadows.card },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.avatar, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, color: colors.brandDark },
  name: { fontSize: 20, color: colors.ink, textAlign: 'center', marginTop: 16 },
  email: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.brandPale, marginTop: 12 },
  role: { color: colors.brandDark, fontSize: 12 },
  error: { color: colors.alert, backgroundColor: colors.alertPale, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 21, width: '100%', textAlign: 'center' },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', marginTop: 24, width: '100%' },
  pressed: { backgroundColor: colors.brandPale, borderColor: colors.brandSoft },
  dimmed: { opacity: 0.7 },
  buttonText: { color: colors.brand, fontSize: 14 },
});
