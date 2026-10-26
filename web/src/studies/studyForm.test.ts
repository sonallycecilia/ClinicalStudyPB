import { describe, expect, it } from 'vitest';
import { onlyDigits } from './studyForm';

describe('onlyDigits', () => {
  it('aceita apenas algarismos em limites e quantidades', () => {
    expect(onlyDigits('6e67')).toBe('667');
    expect(onlyDigits('653e')).toBe('653');
    expect(onlyDigits('-2,5$')).toBe('25');
    expect(onlyDigits('40')).toBe('40');
    expect(onlyDigits('')).toBe('');
  });
});
