/**
 * VANTA-007 regression tests — analytics telemetry identity is server-authoritative.
 *
 * Public telemetry may remain anonymous, but client-supplied userId/sessionId
 * must never be persisted as an authenticated identity. Valid access tokens
 * bind telemetry to the current, active database session.
 */
import { beforeAll, afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';

jest.mock('../prisma', () => ({
  prisma: {
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userSettings: {
      findUnique: jest.fn(),
    },
    consentRecord: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../security/auditLog', () => ({
  auditLog: { log: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../services/analytics-events.service', () => ({
  analyticsEventsService: {
    track: jest.fn().mockResolvedValue(undefined),
    trackBatch: jest.fn().mockResolvedValue(undefined),
  },
}));

import { prisma } from '../prisma';
import { analyticsEventsService } from '../services/analytics-events.service';
import analyticsRoutes from '../routes/analytics.routes';

const JWT_SECRET = 'analytics-identity-test-secret';

function signToken(userId: string, sessionId: string): string {
  return jwt.sign(
    { userId, role: 'USER', sessionId, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

describe('/api/analytics telemetry identity (VANTA-007)', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error: Error | undefined) => error ? reject(error) : resolve()));
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'session-authenticated',
      userId: 'real-user',
      token: 'stored-token',
      expiresAt: new Date(Date.now() + 60_000),
    });
    (prisma.session.update as jest.Mock).mockResolvedValue({});
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'real-user',
      status: 'ACTIVE',
      role: 'USER',
    });
    (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ cookieAnalytics: true });
    (prisma.consentRecord.findFirst as jest.Mock).mockResolvedValue(null);
  });

  test('anonymous single-event telemetry cannot claim a user or session', async () => {
    const response = await fetch(`${baseUrl}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'page_view',
        userId: 'victim-user',
        sessionId: 'victim-session',
      }),
    });

    expect(response.status).toBe(200);
    expect(analyticsEventsService.track).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'page_view',
      userId: undefined,
      sessionId: undefined,
    }));
  });

  test('authenticated single-event telemetry uses the verified session identity', async () => {
    const token = signToken('real-user', 'session-authenticated');
    const response = await fetch(`${baseUrl}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        eventType: 'page_view',
        userId: 'victim-user',
        sessionId: 'victim-session',
      }),
    });

    expect(response.status).toBe(200);
    expect(analyticsEventsService.track).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'page_view',
      userId: 'real-user',
      sessionId: 'session-authenticated',
    }));
  });

  test('batch telemetry binds every event to the verified session identity', async () => {
    const token = signToken('real-user', 'session-authenticated');
    const response = await fetch(`${baseUrl}/api/analytics/track/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        events: [
          { eventType: 'page_view', userId: 'victim-one', sessionId: 'session-one' },
          { eventType: 'like', userId: 'victim-two', sessionId: 'session-two' },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(analyticsEventsService.trackBatch).toHaveBeenCalledWith([
      expect.objectContaining({ eventType: 'page_view', userId: 'real-user', sessionId: 'session-authenticated' }),
      expect.objectContaining({ eventType: 'like', userId: 'real-user', sessionId: 'session-authenticated' }),
    ]);
  });

  test('authenticated telemetry is skipped when analytics cookies are disabled', async () => {
    (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ cookieAnalytics: false });
    const token = signToken('real-user', 'session-authenticated');
    const response = await fetch(`${baseUrl}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventType: 'page_view' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, tracked: false });
    expect(analyticsEventsService.track).not.toHaveBeenCalled();
  });

  test('authenticated telemetry is skipped after explicit analytics consent denial', async () => {
    (prisma.consentRecord.findFirst as jest.Mock).mockResolvedValue({
      type: 'analytics',
      granted: false,
    });
    const token = signToken('real-user', 'session-authenticated');
    const response = await fetch(`${baseUrl}/api/analytics/track/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: [{ eventType: 'page_view' }] }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, tracked: false });
    expect(analyticsEventsService.trackBatch).not.toHaveBeenCalled();
  });

  test('an invalid bearer token is rejected rather than downgraded to anonymous tracking', async () => {
    const response = await fetch(`${baseUrl}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({ eventType: 'page_view', userId: 'victim-user' }),
    });

    expect(response.status).toBe(401);
    expect(analyticsEventsService.track).not.toHaveBeenCalled();
  });
});
