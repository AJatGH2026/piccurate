import type { CloudProvider } from './interface';
import { oneDrive } from './onedrive';
import { dropbox } from './dropbox';

export const CLOUD_PROVIDERS: CloudProvider[] = [dropbox, oneDrive];

/** Providers whose OAuth app key is configured (env) — others are hidden in the UI. */
export function enabledCloudProviders(): CloudProvider[] {
  return CLOUD_PROVIDERS.filter((p) => p.isConfigured());
}

export type { CloudProvider, CloudFile, CloudProgress } from './interface';
