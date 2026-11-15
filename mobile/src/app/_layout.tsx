import { Stack, useSegments } from 'expo-router';
import { AuthProvider, useAuth, type AuthStatus } from '../auth/AuthContext';

export default function RootLayout() {
  const segments = useSegments();
  // A prévia não inicializa armazenamento nem consulta a sessão real.
  if (__DEV__ && segments[0] === 'preview') return <RouteStack status="unauthenticated" previewOnly />;
  return <AuthProvider><Navigation /></AuthProvider>;
}

function Navigation() {
  const { status, user } = useAuth();
  return <RouteStack status={status} participant={user?.role === 'Participante' && user.status === 'Ativo'} />;
}

function RouteStack({ status, participant = false, previewOnly = false }: { status: AuthStatus; participant?: boolean; previewOnly?: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!previewOnly && status === 'unauthenticated'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!previewOnly && status === 'authenticated' && participant}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!previewOnly && (status === 'initializing' || status === 'verifying' || status === 'validation-error')}>
        <Stack.Screen name="session" />
      </Stack.Protected>
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="preview" />
      </Stack.Protected>
    </Stack>
  );
}
