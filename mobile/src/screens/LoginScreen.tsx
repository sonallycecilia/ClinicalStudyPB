import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, type TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { colors, layout, shadows, useTypography } from '../ui/theme';

export default function LoginScreen() {
  const { login, message } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [developmentNotice, setDevelopmentNotice] = useState<'password' | 'support' | null>(null);
  const submitting = useRef(false);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const type = useTypography();

  async function submit() {
    if (submitting.current) return;
    setError('');
    if (!email.trim() || !password) { setError('Preencha o e-mail e a senha.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Informe um e-mail válido.'); return; }
    submitting.current = true;
    setLoading(true);
    try { await login(email, password); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar. Tente novamente.'); }
    finally { submitting.current = false; setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.page}>
            <View pointerEvents="none" accessible={false} style={styles.topDecoration} />
            <Image source={require('../../assets/brand/login-glow-left.png')} contentFit="fill"
              pointerEvents="none" accessible={false} style={styles.sideDecoration} />
            <View style={styles.header}><Brand /></View>
            <View style={styles.section}>
              <View style={styles.intro}>
                <View style={styles.participantIcon}><Icon name="profile" color={colors.brand} /></View>
                <Text style={[styles.eyebrow, type.extraBold]}>ÁREA DO PARTICIPANTE</Text>
                <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>Bem-vindo de volta</Text>
                <Text style={[styles.subtitle, type.regular]}>Acompanhe seu estudo clínico com segurança e tranquilidade.</Text>
              </View>
              <View style={styles.form}>
                <Field label="E-mail" icon="mail" placeholder="Digite seu e-mail"
                  value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  autoComplete="username" editable={!loading} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />
                <View>
                  <Field label="Senha" icon="lock" inputRef={passwordInput} placeholder="Digite sua senha"
                  value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false}
                  autoComplete="current-password" editable={!loading} returnKeyType="go" onSubmitEditing={() => void submit()}
                  action={<Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
                    accessibilityState={{ checked: visible }} onPress={() => setVisible(!visible)} style={styles.toggle}>
                    <Icon name={visible ? 'eyeOff' : 'eye'} />
                  </Pressable>} />
                  <View style={styles.forgotRow}>
                    <Pressable accessibilityRole="button" disabled={loading} accessibilityState={{ disabled: loading }} hitSlop={12}
                      onPress={() => setDevelopmentNotice('password')} style={[styles.forgotAction, loading && styles.dimmed]}>
                      {({ pressed }) => <Text style={[styles.forgotText, type.bold, pressed && styles.forgotPressed]}>Esqueci minha senha</Text>}
                    </Pressable>
                  </View>
                  {developmentNotice === 'password' && <Text accessibilityLiveRegion="polite" style={[styles.developmentNotice, styles.passwordNotice, type.medium]}>Funcionalidade em desenvolvimento</Text>}
                </View>
                {!!(error || message) && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, type.medium]}>{error || message}</Text>}
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading}
                  onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.dimmed]}>
                  {loading && <ActivityIndicator color={colors.white} />}
                  <Text style={[styles.buttonText, type.extraBold]}>{loading ? 'Entrando…' : 'Entrar'}</Text>
                  {!loading && <Icon name="chevron" color={colors.white} />}
                </Pressable>
              </View>
              <View style={styles.footer}>
                <Pressable accessibilityRole="button" disabled={loading} accessibilityState={{ disabled: loading }} hitSlop={4}
                  onPress={() => setDevelopmentNotice('support')} style={({ pressed }) => [styles.supportAction, pressed && styles.supportPressed, loading && styles.dimmed]}>
                  <Icon name="headphones" size={16} />
                  <Text style={[styles.supportText, type.semibold]}>Precisa de ajuda? Fale com o suporte</Text>
                </Pressable>
                {developmentNotice === 'support' && <Text accessibilityLiveRegion="polite" style={[styles.developmentNotice, type.medium]}>Funcionalidade em desenvolvimento</Text>}
                <Text style={[styles.footerText, type.regular]}>Acesso seguro e confidencial</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center' },
  page: { flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, overflow: 'hidden' },
  topDecoration: { position: 'absolute', right: -96, top: -80, width: 256, height: 256, borderRadius: 128, backgroundColor: colors.brandPale },
  // Recorte visível do círculo do Figma: left -112, top 208, 208 px, blur 40 px.
  // Os 160 px de margem superior do desfoque ficam dentro da imagem.
  sideDecoration: { position: 'absolute', left: 0, top: 48, width: 256, height: 528 },
  header: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  section: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  intro: { marginBottom: 36 },
  participantIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  eyebrow: { color: colors.brand, fontSize: 14, letterSpacing: 1.96, marginBottom: 8 },
  title: { fontSize: 32, color: colors.ink, lineHeight: 40, letterSpacing: -1.12 },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 12, lineHeight: 24 },
  form: { gap: 20 },
  toggle: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, borderRadius: 12 },
  forgotRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  forgotAction: { borderRadius: 8 },
  forgotText: { color: colors.brand, fontSize: 14, lineHeight: 20, textAlign: 'right' },
  forgotPressed: { color: colors.brandDark },
  developmentNotice: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  passwordNotice: { textAlign: 'right' },
  error: { color: colors.alert, backgroundColor: colors.alertPale, borderWidth: 1, borderColor: colors.alertLine, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 21 },
  button: { backgroundColor: colors.brand, minHeight: 56, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, boxShadow: shadows.button },
  pressed: { backgroundColor: colors.brandDark },
  dimmed: { opacity: 0.7 },
  buttonText: { color: colors.white, fontSize: 16 },
  footer: { alignItems: 'center', marginTop: 'auto', paddingTop: 40 },
  supportAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  supportPressed: { backgroundColor: colors.surface },
  supportText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  footerText: { fontSize: 12, color: colors.placeholder, textAlign: 'center', marginTop: 12 },
});
