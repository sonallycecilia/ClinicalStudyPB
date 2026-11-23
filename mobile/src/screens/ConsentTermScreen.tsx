import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConsentButton } from '../components/ConsentButton';
import { Icon } from '../components/Icon';
import { useConsent } from '../consent/ConsentContext';
import { consentTerm } from '../consent/consentTerm';
import { colors, layout, useTypography } from '../ui/theme';

export default function ConsentTermScreen() {
  const { accepted, accept } = useConsent();
  const [checked, setChecked] = useState(false);
  const type = useTypography();
  const back = () => router.replace('/primeiro-acesso');

  function confirm() {
    if (!checked || accepted) return;
    accept();
    back();
  }

  return <SafeAreaView style={styles.safe}>
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={back}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Icon name="arrowLeft" size={20} color={colors.brandDark} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.heading, type.extraBold]}>Termo de Consentimento</Text>
      </View>
      <ScrollView accessibilityLabel="Texto integral do termo" style={styles.scroll} contentContainerStyle={styles.article}>
        <View style={styles.termHeader}>
          <Text accessibilityRole="header" style={[styles.title, type.extraBold]}>{consentTerm.title}</Text>
          <Text style={[styles.institution, type.bold]}>{consentTerm.institution}</Text>
          <View style={styles.version}><Text style={[styles.versionText, type.bold]}>Versão {consentTerm.version} | {consentTerm.publication}</Text></View>
        </View>
        {consentTerm.sections.map((section, index) => <View key={section.title} style={[styles.section, index === consentTerm.sections.length - 1 && styles.lastSection]}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, type.extraBold]}>{section.title}</Text>
          <View style={styles.blocks}>
            {section.blocks.map((block, blockIndex) => {
              if (block.type === 'list') return <View key={blockIndex} style={styles.list}>
                {block.items.map(item => <View key={item} style={styles.listItem}>
                  <Text style={[styles.bullet, type.regular]}>•</Text>
                  <Text style={[styles.body, styles.listText, type.regular]}>{item}</Text>
                </View>)}
              </View>;
              if (block.type === 'declaration') return <Text key={blockIndex} style={[styles.body, type.regular]}>
                {block.before}<Text style={type.bold}>{block.emphasis}</Text>{block.after}
              </Text>;
              return <Text key={blockIndex} style={[styles.body, block.type === 'strong' ? type.bold : type.regular]}>{block.text}</Text>;
            })}
          </View>
        </View>)}
      </ScrollView>
      <View style={styles.footer}>
        {accepted ? <View accessibilityLiveRegion="polite" style={styles.accepted}>
          <Icon name="check" size={16} color={colors.successDark} />
          <Text style={[styles.acceptedText, type.bold]}>Termo de consentimento aceito</Text>
        </View> : <>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Li e concordo com o Termo de Consentimento e Compromisso do Participante."
            accessibilityState={{ checked }} onPress={() => setChecked(value => !value)} style={styles.checkboxLabel}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <Icon name="check" size={16} color={colors.white} />}</View>
            <Text style={[styles.checkboxText, type.semibold]}>Li e concordo com o Termo de Consentimento e Compromisso do Participante.</Text>
          </Pressable>
          <ConsentButton disabled={!checked} onPress={confirm}>Confirmar aceite</ConsentButton>
        </>}
        <Pressable accessibilityRole="button" onPress={back} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <Text style={[styles.cancelText, type.bold]}>{accepted ? 'Voltar' : 'Voltar sem aceitar'}</Text>
        </Pressable>
      </View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white, alignItems: 'center' }, page: { flex: 1, width: '100%', maxWidth: layout.maxWidth },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 24, paddingVertical: 16 },
  back: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, color: colors.ink, fontSize: 18, lineHeight: 28, letterSpacing: -0.45 }, pressed: { backgroundColor: colors.surface },
  scroll: { flex: 1, backgroundColor: colors.surface }, article: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36 },
  termHeader: { borderBottomWidth: 1, borderColor: colors.line, paddingBottom: 24 },
  title: { fontSize: 20, lineHeight: 28, letterSpacing: -0.5, color: colors.ink },
  institution: { fontSize: 14, lineHeight: 24, color: colors.brandDark, marginTop: 12 },
  version: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.brandPale, paddingHorizontal: 12, paddingVertical: 4, marginTop: 16 },
  versionText: { fontSize: 12, lineHeight: 16, color: colors.brandDark },
  section: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 24 }, lastSection: { borderBottomWidth: 0, paddingBottom: 0 },
  sectionTitle: { fontSize: 16, lineHeight: 24, color: colors.ink, marginBottom: 12 }, blocks: { gap: 12 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 23.8 }, list: { gap: 8 }, listItem: { flexDirection: 'row', gap: 8 },
  bullet: { color: colors.brand, fontSize: 14, lineHeight: 23.8, width: 12, textAlign: 'center' }, listText: { flex: 1 },
  footer: { flexShrink: 0, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, backgroundColor: colors.white },
  checkboxLabel: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  checkbox: { width: 20, height: 20, marginTop: 2, borderWidth: 1, borderColor: colors.muted, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderRadius: 2 },
  checkboxChecked: { backgroundColor: colors.brandDark, borderColor: colors.brandDark }, checkboxText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  accepted: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.successSoft, paddingHorizontal: 12, paddingVertical: 10 },
  acceptedText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.successDark },
  cancel: { minHeight: 44, marginTop: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.brandDark, fontSize: 14, lineHeight: 20 },
});
