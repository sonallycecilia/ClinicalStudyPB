import { Stack } from 'expo-router';
import { AuthProvider, useAuth, type AuthStatus } from '../auth/AuthContext';
import { VisualThemeProvider } from '../ui/theme';
import { ConsentProvider, useConsent } from '../consent/ConsentContext';

export default function RootLayout() {
  return <VisualThemeProvider><AuthProvider><ConsentProvider><Navigation /></ConsentProvider></AuthProvider></VisualThemeProvider>;
}

function Navigation() {
  const { status, user } = useAuth();
  const { needsFirstAccess } = useConsent();
  return <RouteStack status={status} participant={user?.role === 'Participante' && user.status === 'Ativo'} needsFirstAccess={needsFirstAccess} />;
}

function RouteStack({ status, participant = false, needsFirstAccess }: { status: AuthStatus; participant?: boolean; needsFirstAccess: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'authenticated' && participant && needsFirstAccess}>
        <Stack.Screen name="primeiro-acesso" />
        <Stack.Screen name="termo-consentimento" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'authenticated' && participant && !needsFirstAccess}>
        <Stack.Screen name="index" />
        <Stack.Screen name="estudos/[id]" />
        <Stack.Screen name="visitas" />
        <Stack.Screen name="perfil" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'initializing' || status === 'verifying' || status === 'validation-error'}>
        <Stack.Screen name="session" />
      </Stack.Protected>
    </Stack>
  );
}
