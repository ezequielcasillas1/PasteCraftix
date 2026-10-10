/**
 * Snapshot stack for clip viewer study-format actions.
 */

export const STUDY_UNDO_LIMIT = 40;

export function createStudyUndo() {
  const stack = [];

  return {
    push(snapshot) {
      if (!snapshot || typeof snapshot.text !== 'string') return false;
      const start = Number(snapshot.selectionStart) || 0;
      const end = Number(snapshot.selectionEnd);
      const next = {
        text: snapshot.text,
        selectionStart: start,
        selectionEnd: Number.isFinite(end) ? end : snapshot.text.length,
      };
      const last = stack[stack.length - 1];
      if (
        last &&
        last.text === next.text &&
        last.selectionStart === next.selectionStart &&
        last.selectionEnd === next.selectionEnd
      ) {
        return false;
      }
      stack.push(next);
      if (stack.length > STUDY_UNDO_LIMIT) stack.shift();
      return true;
    },
    pop() {
      return stack.pop() || null;
    },
    clear() {
      stack.length = 0;
    },
    canUndo() {
      return stack.length > 0;
    },
  };
}
