import { Redirect, Stack, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthPreviewProvider } from '../../auth/AuthContext';

export default function PreviewLayout() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <AuthPreviewProvider onLogin={() => router.replace('/preview/inicio')} onLogout={() => router.replace('/preview/login')}>
      <SafeAreaView edges={['top']} style={styles.banner}>
        <View style={styles.row}>
          <Text style={styles.text}>PRÉVIA · Dados fictícios · Sem backend</Text>
        </View>
      </SafeAreaView>
      <Stack screenOptions={{ headerShown: true, headerTitle: 'Prévia das telas', headerBackButtonDisplayMode: 'minimal' }} />
    </AuthPreviewProvider>
  );
}
const styles = StyleSheet.create({
  banner: { backgroundColor: '#FFF3CD' },
  row: { padding: 12 },
  text: { textAlign: 'center', color: '#664D03', fontSize: 12, fontWeight: '600' },
});
