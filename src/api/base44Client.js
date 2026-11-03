import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Only create the SDK client in cloud mode: on creation it calls the Base44
// API (auth + analytics), which just 404s when there is no backend.
export const base44 = appParams.cloud ? createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
}) : null;
