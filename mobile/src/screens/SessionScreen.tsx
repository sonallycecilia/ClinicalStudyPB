import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';

export default function SessionScreen() {
  const { status, message, retry, logout } = useAuth();
  const failed = status === 'validation-error';
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.brand}>ClinicalStudyPB</Text>
        {!failed && <ActivityIndicator accessibilityLabel="Verificando sessão" color="#136F87" />}
        <Text accessibilityRole={failed ? 'alert' : undefined} style={styles.text}>
          {failed ? 'Não foi possível verificar sua sessão' : 'Verificando sua sessão…'}
        </Text>
        {failed && message && message !== 'Não foi possível verificar sua sessão' && <Text style={styles.text}>{message}</Text>}
        {failed && <>
          <Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.button}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.button}>
            <Text style={styles.buttonText}>Sair da conta</Text>
          </Pressable>
        </>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF5FA', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, width: '100%', maxWidth: 420, gap: 16 },
  brand: { color: '#173C58', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  text: { color: '#526779', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { backgroundColor: '#136F87', minHeight: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
