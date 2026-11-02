import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

export default function PreviewIndex() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Testar telas do mobile</Text>
      <Text style={styles.description}>Estas são as telas implementadas no projeto. Nesta prévia, você pode navegar sem iniciar a API ou o banco.</Text>
      <Link href="/preview/login" style={styles.link}>Abrir Login</Link>
      <Link href="/preview/inicio" style={styles.link}>Abrir Inicial da conta</Link>
      <Text style={styles.description}>No login da prévia, informe qualquer e-mail válido e uma senha fictícia para avançar. Nenhuma credencial é enviada ou salva.</Text>
      <Text style={styles.description}>As demais telas do Figma ainda precisam ser adicionadas ao projeto.</Text>
      <Link href="/" style={styles.link}>Voltar ao aplicativo</Link>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: '#EFF5FA', padding: 24, gap: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#173C58' },
  description: { fontSize: 16, lineHeight: 24, color: '#526779', maxWidth: 600 },
  link: { color: '#136F87', fontSize: 18, fontWeight: '600', paddingVertical: 14 },
});
