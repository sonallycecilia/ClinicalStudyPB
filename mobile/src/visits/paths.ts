export const visitsPath = '/visitas' as const;
export const visitPath = (id: string) => ({
  pathname: '/visitas/[id]' as const,
  params: { id },
});
export const visitActionPath = (id: string, action: 'confirmar' | 'reagendar') => ({
  pathname: '/visitas/[id]/[action]' as const,
  params: { id, action },
});
