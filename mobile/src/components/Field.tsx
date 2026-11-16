import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Icon, type IconName } from './Icon';
import { colors, useTypography } from '../ui/theme';

interface FieldProps extends TextInputProps {
  label: string;
  icon: IconName;
  action?: ReactNode;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}

export function Field({ label, icon, action, inputRef, onFocus, onBlur, style, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const type = useTypography();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, type.bold]}>{label}</Text>
      <View style={[styles.control, !!action && styles.withAction, focused && styles.focused]}>
        <Icon name={icon} color={focused ? colors.brand : colors.muted} />
        <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={colors.placeholder}
          {...props} style={[styles.input, type.medium, style]}
          onFocus={event => { setFocused(true); onFocus?.(event); }}
          onBlur={event => { setFocused(false); onBlur?.(event); }} />
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, color: colors.ink },
  control: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  withAction: { paddingRight: 6 },
  focused: { borderColor: colors.brand, boxShadow: `0px 0px 0px 4px ${colors.brandSoft}` },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingVertical: 12, paddingHorizontal: 0, fontSize: 15, color: colors.ink },
});
