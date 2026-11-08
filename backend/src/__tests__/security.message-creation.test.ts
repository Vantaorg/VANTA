import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../services', () => ({
  chatService: { createConversation: jest.fn() },
  notificationService: { createNotification: jest.fn() },
}));
jest.mock('../sockets/chat.socket', () => ({
  broadcastMessageEvent: jest.fn(),
  emitChatUnreadCounts: jest.fn(),
}));

import { chatService } from '../services';
import { startConversation } from '../controllers/message.controller';

function response() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('direct conversation creation authorization', () => {
  test.each(['GROUP', 'CHANNEL'])('rejects %s creation through the direct-message endpoint', async (type) => {
    const res = response();
    await startConversation({
      user: { userId: 'owner1' },
      body: { type, participantIds: ['user2', 'user3'] },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(chatService.createConversation).not.toHaveBeenCalled();
  });

  test('rejects multiple recipients when type is DIRECT', async () => {
    const res = response();
    await startConversation({
      user: { userId: 'owner1' },
      body: { type: 'DIRECT', participantIds: ['user2', 'user3'] },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(chatService.createConversation).not.toHaveBeenCalled();
  });

  test('allows exactly one recipient for a direct message', async () => {
    const res = response();
    (chatService.createConversation as jest.Mock).mockResolvedValue({ id: 'conversation1' });

    await startConversation({
      user: { userId: 'owner1' },
      body: { type: 'DIRECT', participantIds: ['user2'] },
    } as any, res);

    expect(chatService.createConversation).toHaveBeenCalledWith(
      ['owner1', 'user2'],
      undefined,
      false,
      { type: 'DIRECT', createdById: 'owner1' },
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
