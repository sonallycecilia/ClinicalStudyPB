import { Stack } from 'expo-router';
import { VisitsProvider } from '../visits/VisitsContext';

export function VisitsLayout() {
  return <VisitsProvider><Stack screenOptions={{ headerShown: false }} /></VisitsProvider>;
}
export default VisitsLayout;
