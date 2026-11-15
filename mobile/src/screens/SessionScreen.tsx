import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../components/Brand';
import { colors, layout, shadows, useTypography } from '../ui/theme';

export default function SessionScreen() {
  const { status, message, retry, logout } = useAuth();
  const failed = status === 'validation-error';
  const type = useTypography();
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.brand}><Brand /></View>
        {!failed && <ActivityIndicator accessibilityLabel="Verificando sessão" color={colors.brand} />}
        <Text accessibilityRole={failed ? 'alert' : undefined} style={[styles.title, type.extraBold]}>
          {failed ? 'Não foi possível verificar sua sessão' : 'Verificando sua sessão…'}
        </Text>
        {failed && message && message !== 'Não foi possível verificar sua sessão' && <Text style={[styles.text, type.regular]}>{message}</Text>}
        {failed && <>
          <Pressable accessibilityRole="button" onPress={() => void retry()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, type.extraBold]}>Tentar novamente</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void logout()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}>
            <Text style={[styles.secondaryButtonText, type.extraBold]}>Sair da conta</Text>
          </Pressable>
        </>}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line,
    padding: 24, width: '100%', maxWidth: layout.maxWidth, gap: 20, boxShadow: shadows.card },
  brand: { alignItems: 'center', marginBottom: 12 },
  title: { color: colors.ink, fontSize: 20, lineHeight: 28, textAlign: 'center', letterSpacing: -0.5 },
  text: { color: colors.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' },
  button: { backgroundColor: colors.brand, minHeight: 56, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', boxShadow: shadows.button },
  pressed: { backgroundColor: colors.brandDark },
  buttonText: { color: colors.white, fontSize: 16, textAlign: 'center' },
  secondaryButton: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' },
  secondaryPressed: { backgroundColor: colors.brandPale },
  secondaryButtonText: { color: colors.brand, fontSize: 14, textAlign: 'center' },
});
