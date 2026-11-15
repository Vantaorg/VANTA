import { removeModeratedContent } from '../services/content-removal.service';

const createTx = () => ({
  post: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  video: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  story: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  postComment: {
    findUnique: jest.fn().mockResolvedValue({ id: 'target-1' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  videoComment: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  message: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
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
    ['MESSAGE', 'message', ['Message']],
  ];

  test.each(removalCases)('permanently removes %s and tombstones its uploads', async (targetType, delegate, recordTypes) => {
    const tx = createTx();
    await removeModeratedContent(tx as any, targetType, 'target-1');
    expect((tx as any)[delegate].deleteMany).toHaveBeenCalledWith({ where: { id: 'target-1' } });
    expect(tx.uploadedFile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ recordId: 'target-1' }) }));
    expect(tx.uploadedFile.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recordType: { in: recordTypes }, recordId: 'target-1' }),
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    }));
  });

  test('removes a post comment when COMMENT targets a PostComment', async () => {
    const tx = createTx();
    await removeModeratedContent(tx as any, 'COMMENT', 'target-1');
    expect(tx.postComment.deleteMany).toHaveBeenCalledWith({ where: { id: 'target-1' } });
    expect(tx.videoComment.deleteMany).not.toHaveBeenCalled();
  });

  test('falls back to VideoComment when COMMENT is not a PostComment', async () => {
    const tx = createTx();
    tx.postComment.findUnique.mockResolvedValue(null);
    await removeModeratedContent(tx as any, 'COMMENT', 'target-1');
    expect(tx.videoComment.deleteMany).toHaveBeenCalledWith({ where: { id: 'target-1' } });
  });

  test('ends a live stream and tombstones its recorded uploads', async () => {
    const tx = createTx();
    await removeModeratedContent(tx as any, 'LIVE_STREAM', 'target-1');
    expect(tx.liveStream.updateMany).toHaveBeenCalledWith({
      where: { id: 'target-1' },
      data: expect.objectContaining({ active: false, status: 'ENDED', endedAt: expect.any(Date) }),
    });
    expect(tx.uploadedFile.updateMany).toHaveBeenCalled();
  });

  test('fails closed for unsupported targets and missing content', async () => {
    const tx = createTx();
    await expect(removeModeratedContent(tx as any, 'COMMUNITY', 'target-1')).rejects.toThrow('Unsupported moderation target type');
    tx.post.deleteMany.mockResolvedValue({ count: 0 });
    await expect(removeModeratedContent(tx as any, 'POST', 'missing')).rejects.toThrow('Post not found');
  });

  test('rejects an empty target ID without touching the database', async () => {
    const tx = createTx();
    await expect(removeModeratedContent(tx as any, 'POST', '')).rejects.toThrow('target ID is required');
    expect(tx.post.deleteMany).not.toHaveBeenCalled();
  });
});
