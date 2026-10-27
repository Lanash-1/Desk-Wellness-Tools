import { useContext } from 'react';
import type { Platform } from '@/platform';
import { PlatformContext } from './platformContext';

export function usePlatform(): Platform {
  const p = useContext(PlatformContext);
  if (!p) throw new Error('usePlatform must be used inside PlatformProvider');
  return p;
}
