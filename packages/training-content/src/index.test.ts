import { describe, expect, it } from 'vitest';
import { playableLessons, trainingLessons } from './index';
describe('training content gate', () => {
  it('never exposes drafts as playable', () => expect(playableLessons()).toHaveLength(0));
  it('has text alternatives', () => expect(trainingLessons.every((lesson) => lesson.transcriptNe && lesson.transcriptEn)).toBe(true));
});
