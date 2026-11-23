import { fireEvent, screen } from 'expo-router/testing-library';

export async function completeFirstAccess() {
  await fireEvent.press(await screen.findByRole('button', { name: /Visualizar termo de consentimento/ }));
  await fireEvent.press(await screen.findByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirmar aceite' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }));
}
