import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, shadows, useTypography } from '../ui/theme';

export function ConsentButton({ children, disabled, onPress }: { children: string; disabled: boolean; onPress: () => void }) {
  const type = useTypography();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.label, type.extraBold, disabled && styles.disabledLabel]}>{children}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 56, width: '100%', borderRadius: 16, backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', boxShadow: shadows.button },
  pressed: { backgroundColor: colors.brandDark, transform: [{ translateY: 1 }] },
  disabled: { backgroundColor: colors.brandPale, boxShadow: 'none' },
  label: { fontSize: 16, lineHeight: 24, color: colors.white },
  disabledLabel: { color: colors.muted },
});
