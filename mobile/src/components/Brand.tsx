import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, useTypography } from '../ui/theme';

export function Brand({ compact = false }: { compact?: boolean }) {
  const type = useTypography();
  return (
    <View style={styles.row}>
      <Image source={require('../../assets/brand/clinicalstudypb.svg')} contentFit="contain" accessible={false}
        style={compact ? styles.compactLogo : styles.logo} />
      <View style={styles.name}>
        <Text style={[styles.wordmark, type.extraBold, compact && styles.compactWordmark]}>
          ClinicalStudy<Text style={styles.accent}>PB</Text>
        </Text>
        {!compact && <Text style={[styles.tagline, type.bold]}>PESQUISA QUE CUIDA</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  logo: { width: 48, height: 48 },
  compactLogo: { width: 40, height: 40 },
  name: { flexShrink: 1 },
  wordmark: { fontSize: 20, color: colors.ink, letterSpacing: -0.5 },
  compactWordmark: { fontSize: 17, letterSpacing: -0.425 },
  accent: { color: colors.brand },
  tagline: { color: colors.muted, fontSize: 11, letterSpacing: 1.98, marginTop: 2 },
});
