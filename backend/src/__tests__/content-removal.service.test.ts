import { removeModeratedContent, restoreModeratedContent } from '../services/content-removal.service';

const createTx = () => ({
  post: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  video: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  story: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  postComment: {
    findUnique: jest.fn().mockResolvedValue({ id: 'target-1', moderationRemovedAt: null }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  videoComment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  message: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  liveStream: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  uploadedFile: {
    findMany: jest.fn().mockResolvedValue([{ id: 'file-1', filename: 'asset.jpg' }]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
});

describe('removeModeratedContent', () => {
  const removalCases: Array<[string, string, string[]]> = [
    ['POST', 'post', ['Post']],
    ['VIDEO', 'video', ['Video', 'Reel']],
    ['STORY', 'story', ['Story']],
    ['POST_COMMENT', 'postComment', ['PostComment']],
    ['VIDEO_COMMENT', 'videoComment', ['VideoComment']],
    ['MESSAGE', 'message', ['Message']],
  ];

  test.each(removalCases)('reversibly hides %s and tombstones its uploads', async (targetType, delegate, recordTypes) => {
    const tx = createTx();
    const files = await removeModeratedContent(tx as any, targetType, 'target-1');
    expect((tx as any)[delegate].updateMany).toHaveBeenCalledWith({
      where: { id: 'target-1', moderationRemovedAt: null },
      data: { moderationRemovedAt: expect.any(Date) },
    });
    expect(tx.uploadedFile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { recordType: { in: recordTypes }, recordId: 'target-1', deletedAt: null },
    }));
    expect(tx.uploadedFile.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { recordType: { in: recordTypes }, recordId: 'target-1', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    }));
    expect(files).toEqual([{ id: 'file-1', filename: 'asset.jpg' }]);
  });

  test('resolves COMMENT to PostComment when the target exists there', async () => {
    const tx = createTx();
    await removeModeratedContent(tx as any, 'COMMENT', 'target-1');
    expect(tx.postComment.updateMany).toHaveBeenCalled();
    expect(tx.videoComment.updateMany).not.toHaveBeenCalled();
  });

  test('falls back to VideoComment when COMMENT is not a PostComment', async () => {
    const tx = createTx();
    tx.postComment.findUnique.mockResolvedValue(null);
    await removeModeratedContent(tx as any, 'COMMENT', 'target-1');
    expect(tx.videoComment.updateMany).toHaveBeenCalled();
  });

  test('ends and hides a live stream without deleting its record', async () => {
    const tx = createTx();
    await removeModeratedContent(tx as any, 'LIVE_STREAM', 'target-1');
    expect(tx.liveStream.updateMany).toHaveBeenCalledWith({
      where: { id: 'target-1', moderationRemovedAt: null },
      data: expect.objectContaining({
        moderationRemovedAt: expect.any(Date),
        active: false,
        status: 'ENDED',
        endedAt: expect.any(Date),
      }),
    });
  });

  test('fails closed for unsupported targets and missing content', async () => {
    const tx = createTx();
    await expect(removeModeratedContent(tx as any, 'COMMUNITY', 'target-1')).rejects.toThrow('Unsupported moderation target type');
    tx.post.updateMany.mockResolvedValue({ count: 0 });
    await expect(removeModeratedContent(tx as any, 'POST', 'missing')).rejects.toThrow('Post not found or already removed');
  });

  test('rejects an empty target ID without touching the database', async () => {
    const tx = createTx();
    await expect(removeModeratedContent(tx as any, 'POST', '')).rejects.toThrow('target ID is required');
    expect(tx.post.updateMany).not.toHaveBeenCalled();
  });
});

describe('restoreModeratedContent', () => {
  test.each([
    ['POST', 'post'],
    ['VIDEO', 'video'],
    ['STORY', 'story'],
    ['POST_COMMENT', 'postComment'],
    ['VIDEO_COMMENT', 'videoComment'],
    ['MESSAGE', 'message'],
  ])('restores a removed %s', async (targetType, delegate) => {
    const tx = createTx();
    await restoreModeratedContent(tx as any, targetType, 'target-1');
    expect((tx as any)[delegate].updateMany).toHaveBeenCalledWith({
      where: { id: 'target-1', moderationRemovedAt: { not: null } },
      data: { moderationRemovedAt: null },
    });
  });

  test('restores COMMENT to the existing PostComment', async () => {
    const tx = createTx();
    tx.postComment.findUnique.mockResolvedValue({ id: 'target-1', moderationRemovedAt: new Date() });
    await restoreModeratedContent(tx as any, 'COMMENT', 'target-1');
    expect(tx.postComment.updateMany).toHaveBeenCalled();
    expect(tx.videoComment.updateMany).not.toHaveBeenCalled();
  });

  test('restores streams as ended rather than restarting a broadcast', async () => {
    const tx = createTx();
    await restoreModeratedContent(tx as any, 'LIVE_STREAM', 'target-1');
    expect(tx.liveStream.updateMany).toHaveBeenCalledWith({
      where: { id: 'target-1', moderationRemovedAt: { not: null } },
      data: { moderationRemovedAt: null },
    });
  });
});
