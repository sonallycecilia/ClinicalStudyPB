/** Remove tudo que não é algarismo, inclusive e, E, +, -, vírgula e pontos. */
export function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}
