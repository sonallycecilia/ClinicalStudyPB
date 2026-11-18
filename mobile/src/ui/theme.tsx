import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import type { TextStyle } from 'react-native';

// Tokens do src/index.css do protótipo, compartilhados pelas telas nativas.
export const colors = {
  white: '#FFFFFF', brand: '#118F84', brandDark: '#0B6F67', brandSoft: '#C9E8E5',
  brandPale: '#E7F5F3', skyPale: '#DCF3F0', ink: '#153532', muted: '#647B77',
  placeholder: '#94A6A3', line: '#E0EBE9', surface: '#F4F9F8', canvas: '#F2F7F6',
  avatar: '#D7EEEB', alert: '#A92E36', alertPale: '#FFF4F3', alertLine: '#FFD8D5',
  success: '#16784A', successSoft: '#E6F7EF', alertDark: '#C83C44', notification: '#EF5B5B',
  preparation: '#FFF8E8', preparationDark: '#956410', preparationLine: '#F3DFB0',
};
export const layout = { maxWidth: 430 };
export const shadows = {
  button: '0px 12px 28px -12px rgba(17, 143, 132, 0.65)',
  card: '0px 8px 25px -18px rgba(21, 53, 50, 0.30)',
  header: '0px 10px 30px -24px rgba(21, 53, 50, 0.35)',
};

const fonts = { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold };
const FontsReadyContext = createContext(false);

export function VisualThemeProvider({ children }: { children: ReactNode }) {
  const [loaded] = useFonts(fonts);
  // Fontes locais; o fallback nativo mantém a interface utilizável mesmo se o carregamento falhar.
  return <FontsReadyContext.Provider value={loaded}>{children}</FontsReadyContext.Provider>;
}

export function useTypography() {
  const ready = useContext(FontsReadyContext);
  return useMemo(() => {
    const font = (family: string, weight: TextStyle['fontWeight']): TextStyle => ready
      ? { fontFamily: family }
      : { fontWeight: weight };
    return {
      regular: font('Manrope_400Regular', '400'), medium: font('Manrope_500Medium', '500'),
      semibold: font('Manrope_600SemiBold', '600'), bold: font('Manrope_700Bold', '700'),
      extraBold: font('Manrope_800ExtraBold', '800'),
    };
  }, [ready]);
}
