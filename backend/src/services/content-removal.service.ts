import type { Prisma } from '@prisma/client';

/**
 * Permanently removes a reported content record and tombstones its uploaded
 * file metadata inside the same transaction. Unknown target types fail closed:
 * a moderation queue item must never be marked REMOVED when no content action
 * was actually performed.
 */
export async function removeModeratedContent(
  tx: Prisma.TransactionClient,
  targetType: string,
  targetId: string,
): Promise<Array<{ id: string; filename: string }>> {
  if (!targetId?.trim()) throw new Error('Moderation target ID is required');

  let removedFiles: Array<{ id: string; filename: string }> = [];

  const removeRecord = async (
    delegate: any,
    label: string,
  ) => {
    const result = await delegate.deleteMany({ where: { id: targetId } });
    if (result.count !== 1) throw new Error(label + ' not found');
  };

  const tombstoneUploads = async (recordTypes: string[]) => {
    const where = { recordType: { in: recordTypes }, recordId: targetId, deletedAt: null };
    const files = await tx.uploadedFile.findMany({
      where,
      select: { id: true, filename: true },
    });
    await tx.uploadedFile.updateMany({
      where,
      data: { deletedAt: new Date() },
    });
    return files;
  };

  switch (targetType.trim().toUpperCase()) {
    case 'POST':
      await removeRecord(tx.post, 'Post');
      removedFiles = await tombstoneUploads(['Post']);
      break;
    case 'VIDEO':
      await removeRecord(tx.video, 'Video');
      removedFiles = await tombstoneUploads(['Video', 'Reel']);
      break;
    case 'STORY':
      await removeRecord(tx.story, 'Story');
      removedFiles = await tombstoneUploads(['Story']);
      break;
    case 'POST_COMMENT':
      await removeRecord(tx.postComment, 'Post comment');
      removedFiles = await tombstoneUploads(['PostComment']);
      break;
    case 'VIDEO_COMMENT':
      await removeRecord(tx.videoComment, 'Video comment');
      removedFiles = await tombstoneUploads(['VideoComment']);
      break;
    case 'COMMENT': {
      const postComment = await tx.postComment.findUnique({ where: { id: targetId }, select: { id: true } });
      if (postComment) {
        await removeRecord(tx.postComment, 'Post comment');
        removedFiles = await tombstoneUploads(['PostComment']);
        break;
      }
      await removeRecord(tx.videoComment, 'Video comment');
      removedFiles = await tombstoneUploads(['VideoComment']);
      break;
    }
    case 'MESSAGE':
      await removeRecord(tx.message, 'Message');
      removedFiles = await tombstoneUploads(['Message']);
      break;
    case 'STREAM':
    case 'LIVE_STREAM': {
      const result = await tx.liveStream.updateMany({
        where: { id: targetId },
        data: { active: false, status: 'ENDED', endedAt: new Date() },
      });
      if (result.count !== 1) throw new Error('Live stream not found');
      removedFiles = await tombstoneUploads(['LiveStream']);
      break;
    }
    default:
      throw new Error('Unsupported moderation target type: ' + targetType);
  }
  return removedFiles;
}
