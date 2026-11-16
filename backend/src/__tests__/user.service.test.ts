import { UserService } from '../services/user.service';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import { CryptoUtils } from '../security/crypto';
import { emailService } from '../services/email.service';

jest.mock('../services/email.service', () => ({
  emailService: {
    sendEmailChangeVerification: jest.fn(),
    sendEmailChangedNotice: jest.fn(),
  },
}));

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    blockedUser: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    mutedUser: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    postComment: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    postLike: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    giftTransaction: {
      aggregate: jest.fn(),
    },
    liveStream: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    profileMedia: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    photo: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    notificationPreferences: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    securityLog: {
      findMany: jest.fn(),
    },
    socialLink: {
      deleteMany: jest.fn(),
    },
    conversation: {
      count: jest.fn(),
    },
    emailChangeRequest: {
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

// We need bcrypt to work properly for the changePassword test
// Mock bcrypt's async functions directly
(jest.mocked(bcrypt).compare as jest.Mock) = jest.fn();
(jest.mocked(bcrypt).genSalt as jest.Mock) = jest.fn();
(jest.mocked(bcrypt).hash as jest.Mock) = jest.fn();

const userService = new UserService();
const mockUser: any = {
  id: 'user1',
  username: 'testuser',
  fullName: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hash',
  avatar: null,
  bio: null,
  verified: false,
  premium: false,
  status: 'ACTIVE',
  phoneNumber: null,
  age: null,
  gender: null,
  country: null,
  city: null,
  googleId: null,
  appleId: null,
  photos: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  profile: {
    id: 'profile1',
    userId: 'user1',
    username: 'testuser',
    fullName: 'Test User',
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    website: null,
    country: null,
    city: null,
    interests: null,
    isOnline: false,
    socialLinks: [],
    media: [],
  },
  posts: [],
  followers: [],
  following: [],
  _count: { followers: 0, following: 0, posts: 0 },
};

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_CHANGE_CODE_SECRET = 'test-email-change-secret-with-at-least-32-bytes';
    jest.spyOn(CryptoUtils, 'verifyPassword').mockResolvedValue(true);
    (prisma.$transaction as jest.Mock).mockImplementation(async callback => callback(prisma));
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    (prisma.notificationPreferences.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.notification.create as jest.Mock).mockResolvedValue({ id: 'notification1' });
    (prisma.notification.count as jest.Mock).mockResolvedValue(1);
    (prisma.giftTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 0 } });
    (prisma.liveStream.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalViewers: 0 } });
    (prisma.liveStream.count as jest.Mock).mockResolvedValue(0);
    (prisma.postLike.count as jest.Mock).mockResolvedValue(0);
    (prisma.postComment.count as jest.Mock).mockResolvedValue(0);
    (prisma.post.count as jest.Mock).mockResolvedValue(0);
    // Set up default bcrypt mocks
    (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt' as never);
    (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash' as never);
  });

  describe('getUserProfile', () => {
    test('should return user profile for valid userId', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const result = await userService.getUserProfile('user1');
      expect(result.id).toBe('user1');
      expect(result.username).toBe('testuser');
      expect(result.counts).toBeDefined();
    });

    test('should throw Error for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(userService.getUserProfile('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('getPublicProfileByUsername', () => {
    test('should return public profile', async () => {
      const mockUserWithFollow = { ...mockUser, _count: { followers: 5, following: 3, posts: 2 } };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserWithFollow);
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyProfile: 'public' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await userService.getPublicProfileByUsername('testuser', 'currentUser');
      expect(result.username).toBe('testuser');
      expect(result.isFollowing).toBe(false);
    });

    test('filters moderation-removed posts and streams from public profile summaries', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, _count: { followers: 5, following: 3, posts: 9 } });
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyProfile: 'public', liveStreamVisibility: 'everyone', privacyLiveStream: 'everyone' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);

      await userService.getPublicProfileByUsername('testuser', 'viewer-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        include: expect.objectContaining({
          posts: expect.objectContaining({ where: { moderationRemovedAt: null } }),
        }),
      }));
      expect(prisma.liveStream.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ moderationRemovedAt: null }),
      }));
      expect(prisma.post.count).toHaveBeenCalledWith({ where: { authorId: 'user1', moderationRemovedAt: null } });
    });

    test('hides current live stream from viewers excluded by live-stream privacy', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userSettings.findUnique as jest.Mock)
        .mockResolvedValueOnce({ privacyProfile: 'public' })
        .mockResolvedValueOnce({ liveStreamVisibility: 'nobody', privacyLiveStream: 'everyone' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await userService.getPublicProfileByUsername('testuser', 'viewer-1');

      expect(result.currentStream).toBeNull();
      expect(prisma.liveStream.findFirst).not.toHaveBeenCalled();
    });

    test('does not expose followers-only live streams to anonymous profile viewers', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userSettings.findUnique as jest.Mock)
        .mockResolvedValueOnce({ privacyProfile: 'public' })
        .mockResolvedValueOnce({ liveStreamVisibility: 'followers', privacyLiveStream: 'everyone' });

      const result = await userService.getPublicProfileByUsername('testuser');

      expect(result.currentStream).toBeNull();
      expect(prisma.liveStream.findFirst).not.toHaveBeenCalled();
    });

    test('shows followers-only current stream only to a viewer who follows the host', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.userSettings.findUnique as jest.Mock)
        .mockResolvedValueOnce({ privacyProfile: 'public' })
        .mockResolvedValueOnce({ liveStreamVisibility: 'followers', privacyLiveStream: 'everyone' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue({ id: 'follow-1' });
      (prisma.liveStream.findFirst as jest.Mock).mockResolvedValue({ id: 'stream-1' });

      const result = await userService.getPublicProfileByUsername('testuser', 'viewer-1');

      expect(result.currentStream).toMatchObject({ id: 'stream-1' });
      expect(prisma.liveStream.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { hostId: 'user1', active: true, status: 'LIVE', moderationRemovedAt: null },
      }));
    });

    test('should throw Error if profile not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(userService.getPublicProfileByUsername('nonexistent')).rejects.toThrow('Profile not found');
    });

    test('should reject viewers of a private profile who are not followers', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, id: 'privatest' });
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyProfile: 'private' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(userService.getPublicProfileByUsername('testuser', 'otherUser')).rejects.toThrow('private');
    });

    test('should allow followers to view a private profile', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, id: 'privatest', _count: { followers: 5, following: 3, posts: 2 } });
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyProfile: 'private' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue({ id: 'followview' });
      const result = await userService.getPublicProfileByUsername('testuser', 'otherUser');
      expect(result).toBeDefined();
    });
  });

  describe('updateProfile', () => {
    test('should update profile fields', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.profile.upsert as jest.Mock).mockResolvedValue(mockUser.profile);

      const result = await userService.updateProfile('user1', { bio: 'New bio', city: 'New York' });
      expect(result).toBeDefined();
    });

    test('should throw for bio exceeding 260 chars', async () => {
      const longBio = 'x'.repeat(261);
      await expect(userService.updateProfile('user1', { bio: longBio })).rejects.toThrow('Bio must be 260 characters or less');
    });
  });

  describe('verified email change', () => {
    test('rejects invalid email addresses before creating a challenge', async () => {
      await expect(userService.requestEmailChange('user1', 'invalid-email', 'currentPass'))
        .rejects.toThrow('Invalid email address');
    });

    test('requires a six-digit verification code', async () => {
      await expect(userService.verifyEmailChange('user1', '123'))
        .rejects.toThrow('Enter the 6-digit verification code');
    });

    test('serializes challenge issuance before enforcing the hourly request limit', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1', email: 'test@example.com', passwordHash: 'hash',
      });
      (prisma.emailChangeRequest.count as jest.Mock).mockResolvedValue(5);

      await expect(userService.requestEmailChange('user1', 'new@example.com', 'currentPass'))
        .rejects.toThrow('Too many email change attempts');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.emailChangeRequest.create).not.toHaveBeenCalled();
    });

    test('invalidates the challenge when the verification email transport throws', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1', email: 'test@example.com', passwordHash: 'hash',
      });
      (prisma.emailChangeRequest.count as jest.Mock).mockResolvedValue(0);
      (prisma.emailChangeRequest.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.emailChangeRequest.create as jest.Mock).mockResolvedValue({ id: 'email-change-1' });
      (emailService.sendEmailChangeVerification as jest.Mock).mockRejectedValue(new Error('provider unavailable'));

      await expect(userService.requestEmailChange('user1', 'new@example.com', 'currentPass'))
        .rejects.toThrow('We could not send the verification email');

      expect(prisma.emailChangeRequest.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'email-change-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    test('invalidates the challenge when the email provider reports no delivery', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1', email: 'test@example.com', passwordHash: 'hash',
      });
      (prisma.emailChangeRequest.count as jest.Mock).mockResolvedValue(0);
      (prisma.emailChangeRequest.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.emailChangeRequest.create as jest.Mock).mockResolvedValue({ id: 'email-change-2' });
      (emailService.sendEmailChangeVerification as jest.Mock).mockResolvedValue({
        delivered: false, transport: 'none',
      });

      await expect(userService.requestEmailChange('user1', 'new@example.com', 'currentPass'))
        .rejects.toThrow('We could not send the verification email');

      expect(prisma.emailChangeRequest.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'email-change-2', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('changePassword', () => {
    test('should change password with valid current password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt' as never);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash' as never);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.changePassword('user1', 'currentPass', 'newPass123');
      expect(result.success).toBe(true);
    });

    test('should throw for incorrect current password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      await expect(userService.changePassword('user1', 'wrongPass', 'newPass123')).rejects.toThrow('Current password is incorrect');
    });

    test('should throw for short new password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(userService.changePassword('user1', 'currentPass', 'short')).rejects.toThrow(
        'New password must be at least 8 characters long'
      );
    });
  });

  describe('followUser', () => {
    test('should follow a user', async () => {
      const targetUser = { ...mockUser, id: 'user2', username: 'targetuser' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(targetUser);
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyFollows: 'everyone', privacyProfile: 'public' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.follow.create as jest.Mock).mockResolvedValue({ id: 'follow1' });

      const result = await userService.followUser('user1', 'targetuser');
      expect(result).toBeDefined();
    });

    test('should throw when following yourself', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(userService.followUser('user1', 'testuser')).rejects.toThrow('Cannot follow yourself');
    });

    test('should reject followers when the target disabled follows', async () => {
      const targetUser = { ...mockUser, id: 'user2', username: 'targetuser' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(targetUser);
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyFollows: 'noone', privacyProfile: 'public' });
      await expect(userService.followUser('user1', 'targetuser')).rejects.toThrow('does not accept new followers');
    });

    test('should reject followers when the target only accepts accounts it follows', async () => {
      const targetUser = { ...mockUser, id: 'user2', username: 'targetuser' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(targetUser);
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyFollows: 'followers', privacyProfile: 'public' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(userService.followUser('user1', 'targetuser')).rejects.toThrow('only accepts followers from accounts it follows');
    });

    test('should allow followers when the target follows them back', async () => {
      const targetUser = { ...mockUser, id: 'user2', username: 'targetuser' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(targetUser);
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ privacyFollows: 'followers', privacyProfile: 'public' });
      (prisma.follow.findUnique as jest.Mock).mockResolvedValue({ id: 'f1' });
      (prisma.follow.create as jest.Mock).mockResolvedValue({ id: 'follow1' });
      const result = await userService.followUser('user1', 'targetuser');
      expect(result).toBeDefined();
    });
  });

  describe('blockUser', () => {
    test('should block a user', async () => {
      const targetUser = { ...mockUser, id: 'user2', username: 'targetuser' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(targetUser);
      (prisma.blockedUser.upsert as jest.Mock).mockResolvedValue({ id: 'block1' });

      const result = await userService.blockUser('user1', 'targetuser');
      expect(result).toBeDefined();
    });

    test('should throw when blocking yourself', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(userService.blockUser('user1', 'testuser')).rejects.toThrow('Cannot block yourself');
    });
  });

  describe('searchUsers', () => {
    test('should search users by username or fullName', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);
      const result = await userService.searchUsers('test');
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteAccount', () => {
    test('should soft-delete account', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, status: 'DELETED' });

      const result = await userService.deleteAccount('user1');
      expect(result.message).toBe('Account deleted successfully');
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserStats', () => {
    test('should return user stats', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.conversation.count as jest.Mock).mockResolvedValue(3);
      (prisma.follow.count as jest.Mock).mockResolvedValue(10);
      (prisma.photo.count as jest.Mock).mockResolvedValue(5);
      (prisma.giftTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 100 } });

      const result = await userService.getUserStats('user1');
      expect(result.matches).toBe(3);
      expect(result.totalEarnings).toBe(100);
    });
  });

  describe('updateOnlineStatus', () => {
    test('should update user online status', async () => {
      (prisma.profile.update as jest.Mock).mockResolvedValue({ ...mockUser.profile, isOnline: true });

      const result = await userService.updateOnlineStatus('user1', true);
      expect(result).toBeDefined();
    });
  });

  describe('muteUser', () => {
    test('should mute a user', async () => {
      const targetUser = { ...mockUser, id: 'user2', username: 'targetuser' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(targetUser);
      (prisma.mutedUser.upsert as jest.Mock).mockResolvedValue({ id: 'mute1' });

      const result = await userService.muteUser('user1', 'targetuser');
      expect(result).toBeDefined();
    });

    test('should throw when muting yourself', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      await expect(userService.muteUser('user1', 'testuser')).rejects.toThrow('Cannot mute yourself');
    });
  });

  describe('getBlockedUsers', () => {
    test('should return blocked users', async () => {
      (prisma.blockedUser.findMany as jest.Mock).mockResolvedValue([{ id: 'block1', target: { id: 'user2', username: 'target' } }]);
      const result = await userService.getBlockedUsers('user1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserSettings', () => {
    test('should upsert and return user settings', async () => {
      const mockSettings = { id: 'settings1', userId: 'user1', theme: 'dark' };
      (prisma.userSettings.upsert as jest.Mock).mockResolvedValue(mockSettings);

      const result = await userService.getUserSettings('user1');
      expect(result).toBeDefined();
    });
  });

  describe('updateUserSettings', () => {
    test('should validate theme value', async () => {
      await expect(userService.updateUserSettings('user1', { theme: 'red' })).rejects.toThrow('Theme must be dark or light');
    });

    test('should validate privacy settings', async () => {
      await expect(userService.updateUserSettings('user1', { privacyProfile: 'invalid' })).rejects.toThrow(
        'Profile privacy must be public or private'
      );
    });
  });
});