import { jest } from '@jest/globals';

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';
export const getItemAsync = jest.fn<(key: string, options?: object) => Promise<string | null>>();
export const setItemAsync = jest.fn<(key: string, value: string, options?: object) => Promise<void>>();
export const deleteItemAsync = jest.fn<(key: string, options?: object) => Promise<void>>();
