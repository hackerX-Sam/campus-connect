export type DemoModeSource = 'manual' | 'offline';

const storageKey = 'campusconnect-demo-mode';
let currentSource: DemoModeSource | null = null;
const listeners = new Set<(source: DemoModeSource | null) => void>();

export function getDemoModeSource(): DemoModeSource | null {
  if (currentSource) return currentSource;
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    return stored === 'manual' || stored === 'offline' ? stored : null;
  } catch {
    return null;
  }
}

export function isDemoMode(): boolean {
  return getDemoModeSource() !== null;
}

export function subscribeDemoMode(listener: (source: DemoModeSource | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setDemoMode(source: DemoModeSource | null): void {
  currentSource = source;
  if (typeof window !== 'undefined') {
    try {
      if (source) window.sessionStorage.setItem(storageKey, source);
      else window.sessionStorage.removeItem(storageKey);
    } catch {
      // Keep the in-memory mode available when browser storage is disabled.
    }
  }
  listeners.forEach((listener) => listener(source));
}

export function enableDemoMode(source: DemoModeSource = 'manual'): void {
  setDemoMode(source);
}

export function disableDemoMode(): void {
  setDemoMode(null);
}

export function enterDemoMode(destination = '/communities'): void {
  enableDemoMode('manual');
  if (typeof window !== 'undefined') window.location.assign(destination);
}