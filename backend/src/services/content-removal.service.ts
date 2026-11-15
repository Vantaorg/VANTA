import type { Prisma } from '@prisma/client';

export type ModeratedFileReference = { id: string; filename: string };

const REMOVAL_TIMESTAMP = () => new Date();

/**
 * Reversibly hides a supported content record. Content remains in the database
 * so a mistaken moderation decision can be restored without reconstructing
 * relationships, comments, likes, or creator metadata.
 */
export async function removeModeratedContent(
  tx: Prisma.TransactionClient,
  targetType: string,
  targetId: string,
): Promise<ModeratedFileReference[]> {
  if (!targetId?.trim()) throw new Error('Moderation target ID is required');

  const removedAt = REMOVAL_TIMESTAMP();
  let recordTypes: string[] = [];

  const hideRecord = async (delegate: any, label: string, data: Record<string, unknown> = {}) => {
    const result = await delegate.updateMany({
      where: { id: targetId, moderationRemovedAt: null },
      data: { ...data, moderationRemovedAt: removedAt },
    });
    if (result.count !== 1) throw new Error(label + ' not found or already removed');
  };

  switch (targetType.trim().toUpperCase()) {
    case 'POST':
      await hideRecord(tx.post, 'Post');
      recordTypes = ['Post'];
      break;
    case 'VIDEO':
    case 'REEL':
      await hideRecord(tx.video, 'Video');
      recordTypes = ['Video', 'Reel'];
      break;
    case 'STORY':
      await hideRecord(tx.story, 'Story');
      recordTypes = ['Story'];
      break;
    case 'POST_COMMENT':
      await hideRecord(tx.postComment, 'Post comment');
      recordTypes = ['PostComment'];
      break;
    case 'VIDEO_COMMENT':
      await hideRecord(tx.videoComment, 'Video comment');
      recordTypes = ['VideoComment'];
      break;
    case 'COMMENT': {
      const postComment = await tx.postComment.findUnique({
        where: { id: targetId },
        select: { id: true, moderationRemovedAt: true },
      });
      if (postComment) {
        if (postComment.moderationRemovedAt) throw new Error('Post comment not found or already removed');
        await hideRecord(tx.postComment, 'Post comment');
        recordTypes = ['PostComment'];
        break;
      }
      await hideRecord(tx.videoComment, 'Video comment');
      recordTypes = ['VideoComment'];
      break;
    }
    case 'MESSAGE':
      await hideRecord(tx.message, 'Message');
      recordTypes = ['Message'];
      break;
    case 'STREAM':
    case 'LIVE_STREAM':
      await hideRecord(tx.liveStream, 'Live stream', {
        active: false,
        status: 'ENDED',
        endedAt: new Date(),
      });
      recordTypes = ['LiveStream'];
      break;
    default:
      throw new Error('Unsupported moderation target type: ' + targetType);
  }

  if (!recordTypes.length) return [];
  const where = { recordType: { in: recordTypes }, recordId: targetId, deletedAt: null };
  const files = await tx.uploadedFile.findMany({
    where,
    select: { id: true, filename: true },
  });
  await tx.uploadedFile.updateMany({
    where,
    data: { deletedAt: removedAt },
  });
  return files;
}

/** Restore a hidden record inside the same transaction as the moderation audit. */
export async function restoreModeratedContent(
  tx: Prisma.TransactionClient,
  targetType: string,
  targetId: string,
): Promise<void> {
  if (!targetId?.trim()) throw new Error('Moderation target ID is required');

  const restoreRecord = async (delegate: any, label: string) => {
    const result = await delegate.updateMany({
      where: { id: targetId, moderationRemovedAt: { not: null } },
      data: { moderationRemovedAt: null },
    });
    if (result.count !== 1) throw new Error(label + ' is not in a restorable removed state');
  };

  switch (targetType.trim().toUpperCase()) {
    case 'POST':
      await restoreRecord(tx.post, 'Post');
      break;
    case 'VIDEO':
    case 'REEL':
      await restoreRecord(tx.video, 'Video');
      break;
    case 'STORY':
      await restoreRecord(tx.story, 'Story');
      break;
    case 'POST_COMMENT':
      await restoreRecord(tx.postComment, 'Post comment');
      break;
    case 'VIDEO_COMMENT':
      await restoreRecord(tx.videoComment, 'Video comment');
      break;
    case 'COMMENT': {
      const postComment = await tx.postComment.findUnique({
        where: { id: targetId },
        select: { id: true, moderationRemovedAt: true },
      });
      if (postComment?.moderationRemovedAt) {
        await restoreRecord(tx.postComment, 'Post comment');
        break;
      }
      await restoreRecord(tx.videoComment, 'Video comment');
      break;
    }
    case 'MESSAGE':
      await restoreRecord(tx.message, 'Message');
      break;
    case 'STREAM':
    case 'LIVE_STREAM':
      // Restored streams remain ENDED; moderation must never restart a broadcast.
      await restoreRecord(tx.liveStream, 'Live stream');
      break;
    default:
      throw new Error('Unsupported moderation target type: ' + targetType);
  }
}
