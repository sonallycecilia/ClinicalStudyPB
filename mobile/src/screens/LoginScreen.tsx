import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);

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
          <View style={styles.brand}>
            <View style={styles.symbol}><Text style={styles.cross}>+</Text></View>
            <Text style={styles.brandName}>ClinicalStudyPB</Text>
            <Text style={styles.tagline}>Seu estudo, mais perto de você.</Text>
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>Acesse sua conta</Text>
            <Text style={styles.subtitle}>Entre para acompanhar sua participação.</Text>
            <Text style={styles.label}>E-mail</Text>
            <TextInput accessibilityLabel="E-mail" style={styles.input} placeholder="seu@email.com" placeholderTextColor="#718096"
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              autoComplete="username" editable={!loading} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput ref={passwordInput} accessibilityLabel="Senha" style={styles.passwordInput} placeholder="Sua senha" placeholderTextColor="#718096"
                value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false}
                autoComplete="current-password" editable={!loading} returnKeyType="go" onSubmitEditing={() => void submit()} />
              <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
                onPress={() => setVisible(!visible)} style={styles.toggle}>
                <Text style={styles.toggleText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
            </View>
            {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading}
              onPress={() => void submit()} style={({ pressed }) => [styles.button, (loading || pressed) && styles.dimmed]}>
              {loading && <ActivityIndicator color="#FFFFFF" />}
              <Text style={styles.buttonText}>{loading ? 'Entrando…' : 'Entrar'}</Text>
            </Pressable>
          </View>
          <Text style={styles.footer}>Acesso restrito a usuários autorizados</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF5FA' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingVertical: 48 },
  brand: { alignItems: 'center', marginBottom: 30 },
  symbol: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#136F87', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  cross: { color: '#FFFFFF', fontSize: 38, fontWeight: '600', lineHeight: 44 },
  brandName: { fontSize: 26, fontWeight: '700', color: '#173C58' },
  tagline: { fontSize: 14, color: '#526779', marginTop: 8 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#DFE8EF' },
  title: { fontSize: 24, fontWeight: '700', color: '#173C58' },
  subtitle: { fontSize: 14, color: '#526779', marginTop: 8, marginBottom: 24, lineHeight: 21 },
  label: { fontSize: 14, fontWeight: '600', color: '#263F52', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#B8CAD7', borderRadius: 12, paddingHorizontal: 14, minHeight: 52, fontSize: 16, color: '#173C58', marginBottom: 18 },
  passwordRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#B8CAD7', borderRadius: 12, marginBottom: 20 },
  passwordInput: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 14, fontSize: 16, color: '#173C58' },
  toggle: { justifyContent: 'center', paddingHorizontal: 14, minHeight: 48 },
  toggleText: { fontSize: 13, color: '#136F87', fontWeight: '600' },
  error: { color: '#AC2430', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  button: { backgroundColor: '#136F87', minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  dimmed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: { marginTop: 26, fontSize: 12, color: '#526779', textAlign: 'center' },
});
