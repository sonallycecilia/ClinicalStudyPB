import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    if (loading) return;
    setLoading(true);
    setError('');
    try { await logout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível sair.'); }
    finally { setLoading(false); }
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>ClinicalStudyPB</Text>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>CONTA CONECTADA</Text>
          <Text accessibilityRole="header" style={styles.title}>Olá, {user?.name}!</Text>
          <Text style={styles.text}>{user?.email}</Text>
          <Text style={styles.role}>{user?.role}</Text>
          <Text style={styles.text}>Seu acesso foi realizado com sucesso. As funcionalidades de acompanhamento pelo aplicativo estarão disponíveis em breve.</Text>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={loading} onPress={() => void signOut()} style={styles.button}>
            <Text style={styles.buttonText}>{loading ? 'Saindo…' : 'Sair da conta'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF5FA' },
  content: { flexGrow: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#173C58', fontSize: 24, fontWeight: '700', marginBottom: 30 },
  card: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 22, width: '100%', maxWidth: 420, gap: 16 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: '#136F87', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700', color: '#173C58' },
  text: { fontSize: 15, color: '#526779', lineHeight: 23 },
  role: { color: '#136F87', fontWeight: '600', fontSize: 14 },
  error: { color: '#AC2430', fontSize: 14 },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#136F87', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
