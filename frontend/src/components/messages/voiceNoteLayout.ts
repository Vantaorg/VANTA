const formatVoiceTime = (seconds: number): string => {
  const safe = Math.floor(seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/** Footer labels shared by sent, received, and recording-preview players. */
export function getVoiceNoteFooterLabels(duration: number, sentAt?: string) {
  return {
    duration: duration > 0 && Number.isFinite(duration) ? formatVoiceTime(duration) : null,
    timestamp: sentAt?.trim() || null,
  };
}
