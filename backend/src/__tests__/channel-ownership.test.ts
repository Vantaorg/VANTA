jest.mock('../prisma', () => ({ prisma: {
  channel: { findUnique: jest.fn(), update: jest.fn() },
  channelMember: { findUnique: jest.fn(), updateMany: jest.fn(), createMany: jest.fn() },
  participant: { updateMany: jest.fn() },
  conversation: { findUnique: jest.fn(), update: jest.fn() },
  channelMessage: { findMany: jest.fn() },
  user: { count: jest.fn() },
  userSettings: { findUnique: jest.fn() },
  follow: { findUnique: jest.fn() },
  $transaction: jest.fn(),
} }));
jest.mock('../security/auditLog', () => ({ auditLog: { log: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../services/chat.service', () => ({ chatService: { getMessages: jest.fn(), sendMessage: jest.fn() } }));

import { prisma } from '../prisma';
import { ChannelService } from '../services/channel.service';
import { chatService } from '../services/chat.service';

const db = prisma as jest.Mocked<typeof prisma>;
const service = new ChannelService();

const makeChannel = (overrides: any = {}) => ({
  id: 'channel-1',
  name: 'Test Channel',
  description: 'desc',
  ownerId: 'owner-1',
  conversationId: 'conversation-1',
  members: [
    { userId: 'owner-1', role: 'ADMIN' },
    { userId: 'member-1', role: 'MEMBER' },
  ],
  ...overrides,
});

describe('ChannelService ownership transfer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.$transaction as jest.Mock).mockImplementation((callback: any) => callback(db));
  });

  it('transfers ownership atomically: new owner becomes OWNER, old owner ADMIN', async () => {
    (db.channel.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeChannel())
      .mockResolvedValueOnce({
        ...makeChannel(),
        ownerId: 'member-1',
        members: [
          { userId: 'owner-1', role: 'ADMIN', user: { id: 'owner-1', username: 'old' } },
          { userId: 'member-1', role: 'OWNER', user: { id: 'member-1', username: 'new' } },
        ],
      });
    (db.channel.update as jest.Mock).mockResolvedValue({});
    (db.channelMember.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (db.participant.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (db.conversation.findUnique as jest.Mock).mockResolvedValue({
      handle: 'test', visibility: 'PUBLIC', permissions: '{}',
    });

    const result = await service.transferOwnership('channel-1', 'owner-1', 'member-1');

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.channel.update).toHaveBeenCalledWith({ where: { id: 'channel-1' }, data: { ownerId: 'member-1' } });
    expect(db.channelMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { channelId: 'channel-1', userId: 'member-1' }, data: { role: 'OWNER' } })
    );
    expect(db.channelMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { channelId: 'channel-1', userId: 'owner-1' }, data: { role: 'ADMIN' } })
    );
    expect(result.ownerId).toBe('member-1');
  });

  it('rejects a non-owner transferring ownership', async () => {
    (db.channel.findUnique as jest.Mock).mockResolvedValue(makeChannel());
    await expect(service.transferOwnership('channel-1', 'member-1', 'owner-1')).rejects.toThrow(
      'Only the channel owner can transfer ownership'
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects transferring to a non-member', async () => {
    (db.channel.findUnique as jest.Mock).mockResolvedValue(makeChannel());
    await expect(service.transferOwnership('channel-1', 'owner-1', 'outsider-1')).rejects.toThrow(
      'The selected member is no longer part of this channel'
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('ChannelService permission enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.$transaction as jest.Mock).mockImplementation((callback: any) => callback(db));
  });

  it('letting admins edit info by default', async () => {
    const channel = makeChannel();
    channel.members = [{ userId: 'admin-1', role: 'ADMIN' }];
    (db.channel.findUnique as jest.Mock)
      .mockResolvedValueOnce(channel)
      .mockResolvedValueOnce({
        ...makeChannel({ name: 'Renamed' }),
        members: [{ userId: 'admin-1', role: 'ADMIN', user: { id: 'admin-1', username: 'a' } }],
      });
    (db.conversation.findUnique as jest.Mock).mockResolvedValue({
      visibility: 'PUBLIC', permissions: '{}', handle: 'test',
    });
    (db.channel.update as jest.Mock).mockResolvedValue({ id: 'channel-1', name: 'Renamed' });
    (db.conversation.update as jest.Mock).mockResolvedValue({});

    const result = await service.updateChannel('channel-1', 'admin-1', { name: 'Renamed' });
    expect(result.name).toBe('Renamed');
  });

  it('blocks info edits from admins when manageChannelInfo is disabled', async () => {
    const channel = makeChannel();
    channel.members = [{ userId: 'admin-1', role: 'ADMIN' }];
    (db.channel.findUnique as jest.Mock).mockResolvedValue(channel);
    (db.conversation.findUnique as jest.Mock).mockResolvedValue({
      visibility: 'PUBLIC', permissions: '{"manageChannelInfo":false}',
    });
    await expect(
      service.updateChannel('channel-1', 'admin-1', { name: 'Hacked' })
    ).rejects.toThrow('Only the channel owner can manage channel information');
  });

  it('blocks adding a subscriber who has disabled community invitations', async () => {
    (db.channel.findUnique as jest.Mock).mockResolvedValue(makeChannel());
    (db.conversation.findUnique as jest.Mock).mockResolvedValue({ visibility: 'PUBLIC', permissions: '{}' });
    (db.userSettings.findUnique as jest.Mock).mockResolvedValue({ communityInvites: 'nobody', privacyInvites: 'everyone' });
    await expect(service.updateChannel('channel-1', 'owner-1', { memberIds: ['owner-1', 'member-1', 'invitee-1'] }))
      .rejects.toThrow('This user is not accepting community invitations');
    expect(db.channelMember.createMany).not.toHaveBeenCalled();
  });

  it('allows followers-only channel invitations only from someone the invitee follows', async () => {
    (db.channel.findUnique as jest.Mock).mockResolvedValue(makeChannel());
    (db.conversation.findUnique as jest.Mock).mockResolvedValue({ visibility: 'PUBLIC', permissions: '{}' });
    (db.userSettings.findUnique as jest.Mock).mockResolvedValue({ communityInvites: 'followers', privacyInvites: 'everyone' });
    (db.follow.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.updateChannel('channel-1', 'owner-1', { memberIds: ['owner-1', 'member-1', 'invitee-1'] }))
      .rejects.toThrow('This user only accepts community invitations from accounts they follow');
    expect(db.follow.findUnique).toHaveBeenCalledWith({
      where: { followerId_followingId: { followerId: 'invitee-1', followingId: 'owner-1' } },
      select: { id: true },
    });
    expect(db.channelMember.createMany).not.toHaveBeenCalled();
  });

  it('prevents admins from changing channel permission grants', async () => {
    const channel = makeChannel();
    channel.members = [{ userId: 'admin-1', role: 'ADMIN' }];
    (db.channel.findUnique as jest.Mock).mockResolvedValue(channel);
    (db.conversation.findUnique as jest.Mock).mockResolvedValue({
      visibility: 'PUBLIC', permissions: '{}',
    });

    await expect(
      service.updateChannel('channel-1', 'admin-1', { permissions: { manageChannelInfo: true, manageSubscribers: true } })
    ).rejects.toThrow('Only the channel owner can change channel permissions');
    expect(db.channel.update).not.toHaveBeenCalled();
    expect(db.conversation.update).not.toHaveBeenCalled();
  });

  it('blocks subscriber changes from admins when manageSubscribers is disabled', async () => {
    const channel = makeChannel();
    channel.members = [{ userId: 'admin-1', role: 'ADMIN' }];
    (db.channel.findUnique as jest.Mock).mockResolvedValue(channel);
    (db.conversation.findUnique as jest.Mock).mockResolvedValue({
      visibility: 'PUBLIC', permissions: '{"manageSubscribers":false}',
    });
    await expect(
      service.updateChannel('channel-1', 'admin-1', { memberIds: ['owner-1', 'member-1', 'newbie-1'] })
    ).rejects.toThrow('Only the channel owner can manage subscribers');
  });
});

describe('ChannelService message access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.$transaction as jest.Mock).mockImplementation((callback: any) => callback(db));
    (db.channel.findUnique as jest.Mock).mockResolvedValue(makeChannel());
    (db.channelMessage.findMany as jest.Mock).mockResolvedValue([]);
    (chatService.getMessages as jest.Mock).mockResolvedValue({ items: [] });
  });

  it('rejects reading posts for non-members', async () => {
    (db.channelMember.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.getMessages('channel-1', 'outsider-1')).rejects.toThrow(
      'Not a member of this channel'
    );
    expect(db.channelMessage.findMany).not.toHaveBeenCalled();
  });

  it('allows members to read posts', async () => {
    (db.channelMember.findUnique as jest.Mock).mockResolvedValue({ id: 'cm' });
    (db.channelMessage.findMany as jest.Mock).mockResolvedValue([]);
    const result = await service.getMessages('channel-1', 'member-1', undefined, 20);
    expect(result.items).toEqual([]);
    expect(chatService.getMessages).toHaveBeenCalledWith('conversation-1', 'member-1', 20, undefined);
  });
});