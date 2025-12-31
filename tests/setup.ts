/**
 * Jest Test Setup File
 *
 * This file runs before all tests and sets up the testing environment:
 * - Mocks IndexedDB using fake-indexeddb
 * - Mocks localStorage and sessionStorage
 * - Mocks Supabase client
 * - Sets up DOM globals for jsdom
 */

import 'fake-indexeddb/auto';
import { TextEncoder, TextDecoder } from 'util';

jest.mock('../src/supabaseClient', () => {
  const { mockSupabaseClient } = require('./mocks/supabase.mock');
  return { supabase: mockSupabaseClient, isSupabaseConfigured: true };
});

// Add TextEncoder/TextDecoder to global (needed for some tests)
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
});

// Mock matchMedia (for viewport/responsive tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock navigator.vibrate (for haptic feedback tests)
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: jest.fn(),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 0);
  return 0;
});

global.cancelAnimationFrame = jest.fn();

// Suppress console.error and console.warn in tests (optional)
// Uncomment if you want cleaner test output
// global.console.error = jest.fn();
// global.console.warn = jest.fn();

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});
