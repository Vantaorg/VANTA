'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getPermissionState,
  isPushSupported,
  registerServiceWorker,
  subscribeAndRegister,
  unsubscribeAndUnregister,
  type PushPermissionState,
} from '@/lib/pushClient';
import { fetchPushConfig, registerDevice, unregisterDeviceByToken } from '@/lib/pushApi';

// ============================================================================
// PushProvider — global OS-push state for the signed-in user.
//
// * Registers the VANTA service worker.
// * NEVER prompts for notification permission on its own (Android 13+ UX):
//   it passively registers when permission is already granted and reports
//   the state so the Settings screen can give the user an explicit opt-in.
// * Re-subscribes when the browser rotates the push subscription
//   (pushsubscriptionchange) and unregisters the device on logout.
// ============================================================================

export type PushStatus =
  | 'unsupported'
  | 'unconfigured'
  | 'permission-pending'
  | 'permission-denied'
  | 'granted'
  | 'enabled'
  | 'network-error'
  | 'error';

interface PushContextValue {
  supported: boolean;
  status: PushStatus;
  permission: PushPermissionState;
  deviceId: string | null;
  /** Operator-facing reason the server said web push is not configured (no secrets). */
  configIssue: string | null;
  /** Re-check server configuration + subscription state. */
  refresh: () => Promise<{ ok: boolean; reason?: string }>;
  enablePush: () => Promise<{ ok: boolean; reason?: string }>;
  disablePush: () => Promise<void>;
}

const PushContext = createContext<PushContextValue | undefined>(undefined);

export function PushProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<PushStatus>('unsupported');
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [configIssue, setConfigIssue] = useState<string | null>(null);
  const [nativeToken, setNativeToken] = useState<string | null>(null);

  const refreshing = useRef(false);
  const lastTokenRef = useRef<string | null>(null);
  const nativeTokenRef = useRef<string | null>(null);
  const registeredNativeTokenRef = useRef<string | null>(null);
  const lastAuthTokenRef = useRef<string | null>(null);

  /** Passive sync: register the SW + register the device IF permission is granted. */
  const syncPassive = useCallback(async (requestPermission: boolean): Promise<{ ok: boolean; reason?: string }> => {
    if (!token || !user) return { ok: false, reason: 'no-session' };
    if (nativeTokenRef.current) {
      setSupported(true);
      return { ok: true };
    }
    if (!isPushSupported()) {
      setStatus('unsupported');
      setSupported(false);
      return { ok: false, reason: 'unsupported' };
    }
    setSupported(true);

    if (refreshing.current) return { ok: false, reason: 'in-flight' };
    refreshing.current = true;
    try {
      let config;
      try {
        config = await fetchPushConfig();
      } catch {
        // A transient network/server error reaching /api/push/config is NOT a
        // server misconfiguration — surface it distinctly so the UI never tells
        // the user to "ask the administrator" for a momentary failure.
        setConfigIssue(null);
        setStatus('network-error');
        return { ok: false, reason: 'network-error' };
      }
      if (!config || !config.vapidPublicKey) {
        // The server EXPLICITLY reported web push as not configured (verified).
        setConfigIssue(config?.webpushConfigIssue || 'Push is not yet configured on the server.');
        setStatus('unconfigured');
        return { ok: false, reason: 'not-configured' };
      }
      setConfigIssue(null);

      await registerServiceWorker();
      const currentPermission = await getPermissionState().catch(() => 'default' as PushPermissionState);
      setPermission(currentPermission);

      if (currentPermission === 'denied' && !requestPermission) {
        setStatus('permission-denied');
        return { ok: false, reason: 'permission-denied' };
      }
      if (currentPermission === 'default' && !requestPermission) {
        setStatus('permission-pending');
        return { ok: false, reason: 'permission-pending' };
      }

      const result = await subscribeAndRegister(token, { requestPermission });
      if (result.ok) {
        setDeviceId(result.deviceId || null);
        lastTokenRef.current = token;
        setStatus(result.permission === 'denied' ? 'permission-denied' : 'enabled');
        return { ok: true };
      }
      setPermission(result.permission || currentPermission);
      if (result.reason === 'permission-denied') setStatus('permission-denied');
      else if (result.reason === 'permission-pending') setStatus('permission-pending');
      else if (result.reason === 'registration-failed' || result.reason === 'subscribe-failed' || result.reason === 'sw-failed') {
        // Permission can be granted while device registration still fails.
        // Surface this as an incomplete state, never as successfully enabled.
        setStatus('network-error');
      } else setStatus('error');
      return { ok: false, reason: result.reason };
    } finally {
      refreshing.current = false;
    }
  }, [token, user, nativeToken]);

  useEffect(() => {
    void syncPassive(false);
  }, [syncPassive]);

  // The native Android shell publishes its FCM registration token only from
  // the trusted VANTA WebView. Keep it separate from the browser's VAPID token.
  useEffect(() => {
    const receiveNativeToken = (event: Event) => {
      const value = (event as CustomEvent<{ token?: string }>).detail?.token;
      if (typeof value === 'string' && value.length >= 20) {
        nativeTokenRef.current = value;
        setNativeToken(value);
        setSupported(true);
        setStatus('permission-pending');
      }
    };
    window.addEventListener('vanta-native-fcm-token', receiveNativeToken);
    return () => window.removeEventListener('vanta-native-fcm-token', receiveNativeToken);
  }, []);

  useEffect(() => {
    if (token) lastAuthTokenRef.current = token;
    if (!token || !user || !nativeToken || registeredNativeTokenRef.current === nativeToken) return;
    let cancelled = false;
    void registerDevice(nativeToken, {
      platform: 'android',
      provider: 'fcm',
      deviceModel: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'Android',
      appVersion: '0.1.0',
    }, token).then((device) => {
      if (!cancelled && device) {
        registeredNativeTokenRef.current = nativeToken;
        setSupported(true);
        setStatus('enabled');
      }
    });
    return () => { cancelled = true; };
  }, [token, user]);

  // Re-sync when the window regains focus and the browser rotated the
  // subscription (handled by the service worker's pushsubscriptionchange).
  useEffect(() => {
    const onFocus = () => {
      if (!refreshing.current) void syncPassive(false);
    };
    const onSwMessage = (event: MessageEvent) => {
      const data = (event as any).data;
      if (data && typeof data === 'object' && data.type === 'vanta-push-subscription-changed') {
        void syncPassive(false);
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('message', onSwMessage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('message', onSwMessage);
    };
  }, [syncPassive]);

  // Logout: best-effort deactivate this device's token server-side.
  useEffect(() => {
    if (!token && nativeTokenRef.current) {
      const nativeToken = nativeTokenRef.current;
      const authToken = lastAuthTokenRef.current;
      if (authToken) void unregisterDeviceByToken(nativeToken, authToken);
      nativeTokenRef.current = null;
      registeredNativeTokenRef.current = null;
      lastAuthTokenRef.current = null;
      setNativeToken(null);
    }
    if (!token && lastTokenRef.current) {
      const hadToken = lastTokenRef.current;
      void unsubscribeAndUnregister(hadToken).finally(() => {
        setDeviceId(null);
        setStatus('unsupported');
        lastTokenRef.current = null;
      });
    }
  }, [token]);

  const enablePush = useCallback(async () => {
    const result = await syncPassive(true);
    if (!result.ok && result.reason === 'permission-denied') setStatus('permission-denied');
    return result;
  }, [syncPassive]);

  const disablePush = useCallback(async () => {
    await unsubscribeAndUnregister(token);
    setDeviceId(null);
    setStatus('permission-pending');
  }, [token]);

  const value: PushContextValue = {
    supported,
    status,
    permission,
    deviceId,
    configIssue,
    refresh: enablePush,
    enablePush,
    disablePush,
  };

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): PushContextValue {
  const context = useContext(PushContext);
  if (!context) throw new Error('usePush must be used within PushProvider');
  return context;
}