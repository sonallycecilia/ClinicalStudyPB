import { Stack } from 'expo-router';
import { AuthProvider, useAuth, type AuthStatus } from '../auth/AuthContext';
import { VisualThemeProvider } from '../ui/theme';

export default function RootLayout() {
  return <VisualThemeProvider><AuthProvider><Navigation /></AuthProvider></VisualThemeProvider>;
}

function Navigation() {
  const { status, user } = useAuth();
  return <RouteStack status={status} participant={user?.role === 'Participante' && user.status === 'Ativo'} />;
}

function RouteStack({ status, participant = false }: { status: AuthStatus; participant?: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'authenticated' && participant}>
        <Stack.Screen name="index" />
        <Stack.Screen name="visitas" />
        <Stack.Screen name="perfil" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'initializing' || status === 'verifying' || status === 'validation-error'}>
        <Stack.Screen name="session" />
      </Stack.Protected>
    </Stack>
  );
}
