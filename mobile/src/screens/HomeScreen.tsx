import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth, type User } from '../auth/AuthContext';
import type { AuthenticatedHttpClient } from '../api/http';
import { DashboardScaffold } from '../components/DashboardScaffold';
import { participantStudiesService, type ParticipantStudy } from '../studies/participantStudiesApi';
import { colors, shadows, useTypography } from '../ui/theme';

type StudiesState =
  | { kind: 'success'; sessionUser: User; client: AuthenticatedHttpClient; requestId: number; studies: ParticipantStudy[] }
  | { kind: 'error'; sessionUser: User; client: AuthenticatedHttpClient; requestId: number; message: string };

const studyStatusLabels: Record<ParticipantStudy['study']['status'], string> = {
  planejamento: 'Planejamento',
  recrutamento: 'Recrutamento',
  execução: 'Em execução',
  encerrado: 'Encerrado',
};

export default function HomeScreen({ profile = false }: { profile?: boolean }) {
  const { status, user, logout, client } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [studiesState, setStudiesState] = useState<StudiesState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const type = useTypography();
  const participantActive = status === 'authenticated' && user?.role === 'Participante' && user.status === 'Ativo';
  const names = user?.name.trim().split(/\s+/) ?? [];
  const initials = names.slice(0, 2).map(name => name[0]).join('').toLocaleUpperCase('pt-BR');

  useEffect(() => {
    if (!participantActive || !user || !client || profile) return;

    let active = true;
    void participantStudiesService.listForAuthenticatedParticipant(client).then(
      studies => {
        if (active) setStudiesState({ kind: 'success', sessionUser: user, client, requestId: retryCount, studies });
      },
      reason => {
        if (!active) return;
        const message = reason instanceof Error && reason.message.trim()
          ? reason.message
          : 'Não foi possível carregar seus estudos. Tente novamente.';
        setStudiesState({ kind: 'error', sessionUser: user, client, requestId: retryCount, message });
      },
    );
    return () => { active = false; };
  }, [participantActive, retryCount, user, client, profile]);

  async function signOut() {
    if (logoutLoading) return;
    setLogoutLoading(true);
    setLogoutError('');
    try { await logout(); }
    catch (reason) { setLogoutError(reason instanceof Error ? reason.message : 'Não foi possível sair.'); }
    finally { setLogoutLoading(false); }
  }

  if (!participantActive || !user) return null;

  const visibleStudiesState = studiesState?.sessionUser === user && studiesState.client === client && studiesState.requestId === retryCount
    ? studiesState
    : { kind: 'loading' as const };

  return (
    <DashboardScaffold activeTab={profile ? 'profile' : 'studies'}>
      {!profile && <>
            <Text style={[styles.eyebrow, type.extraBold]}>SEU ACOMPANHAMENTO</Text>
            <Text accessibilityRole="header" style={[styles.sectionTitle, type.extraBold]}>Meus Estudos Clínicos</Text>
            {visibleStudiesState.kind === 'loading' && (
              <View accessibilityLabel="Carregando estudos" accessibilityRole="progressbar" style={styles.loading}>
                <ActivityIndicator color={colors.brand} size="small" />
                <Text style={[styles.stateText, type.medium]}>Carregando estudos…</Text>
              </View>
            )}
            {visibleStudiesState.kind === 'success' && visibleStudiesState.studies.length === 0 && (
              <View style={styles.stateCard}>
                <Text style={[styles.stateText, type.medium]}>Você ainda não participa de nenhum estudo.</Text>
              </View>
            )}
            {visibleStudiesState.kind === 'success' && visibleStudiesState.studies.length > 0 && (
              <View style={styles.studyList}>
                {visibleStudiesState.studies.map(({ study, participationId, participationStatus }) => (
                  <View key={participationId} style={styles.studyCard}>
                    <View accessible={false} style={styles.studyAccent} />
                    <View style={styles.studyContent}>
                      <View style={styles.statusRow}>
                        <View style={styles.statusBadge}>
                          <View accessible={false} style={styles.statusDot} />
                          <Text style={[styles.statusText, type.extraBold]}>{studyStatusLabels[study.status]}</Text>
                        </View>
                      </View>
                      <Text accessibilityRole="header" style={[styles.studyTitle, type.extraBold]}>{study.title}</Text>
                      <Text numberOfLines={3} style={[styles.studyDescription, type.regular]}>{study.objective}</Text>
                      <Text style={[styles.studyDescription, type.regular]}>Participação: {participationStatus}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {visibleStudiesState.kind === 'error' && (
              <View style={styles.stateCard}>
                <Text accessibilityRole="alert" style={[styles.error, type.medium]}>{visibleStudiesState.message}</Text>
                <Pressable accessibilityRole="button" accessibilityState={{ busy: false }} onPress={() => setRetryCount(count => count + 1)}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={[styles.retryButtonText, type.extraBold]}>Tentar novamente</Text>
                </Pressable>
              </View>
            )}
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
  studyList: { gap: 16 },
  studyCard: { flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, boxShadow: shadows.card },
  studyAccent: { width: 6, backgroundColor: colors.brand },
  studyContent: { flex: 1, padding: 20 },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.brandPale },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  statusText: { fontSize: 11, color: colors.brandDark },
  studyTitle: { fontSize: 18, color: colors.ink, lineHeight: 25 },
  studyDescription: { fontSize: 14, color: colors.muted, lineHeight: 22, marginTop: 8 },
  loading: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  stateCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: colors.line, boxShadow: shadows.card },
  stateText: { fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center' },
  accountSection: { },
  accountCard: { backgroundColor: colors.white, padding: 24, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', boxShadow: shadows.card },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.avatar, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, color: colors.brandDark },
  name: { fontSize: 20, color: colors.ink, textAlign: 'center', marginTop: 16 },
  email: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.brandPale, marginTop: 12 },
  role: { color: colors.brandDark, fontSize: 12 },
  error: { color: colors.alert, backgroundColor: colors.alertPale, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 21, width: '100%', textAlign: 'center' },
  retryButton: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  retryButtonText: { color: colors.white, fontSize: 14 },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', marginTop: 24, width: '100%' },
  pressed: { backgroundColor: colors.brandPale, borderColor: colors.brandSoft },
  dimmed: { opacity: 0.7 },
  buttonText: { color: colors.brand, fontSize: 14 },
});
