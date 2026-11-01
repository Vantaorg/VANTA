import { describe, expect, it } from 'vitest';
import { getVoiceNoteFooterLabels } from './voiceNoteLayout';

describe('getVoiceNoteFooterLabels', () => {
  it('places the real duration on the left and message time in the right slot', () => {
    expect(getVoiceNoteFooterLabels(4.9, '9:23 PM')).toEqual({ duration: '0:04', timestamp: '9:23 PM' });
  });

  it('omits unavailable duration and timestamp instead of showing a 0:00 placeholder', () => {
    expect(getVoiceNoteFooterLabels(0)).toEqual({ duration: null, timestamp: null });
    expect(getVoiceNoteFooterLabels(Number.NaN, '  ')).toEqual({ duration: null, timestamp: null });
  });

  it('does not duplicate the duration when a recording preview has no sent time', () => {
    expect(getVoiceNoteFooterLabels(65)).toEqual({ duration: '1:05', timestamp: null });
  });
});
