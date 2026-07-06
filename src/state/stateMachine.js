// state/stateMachine.js
// Minimal transition-guarded state machine. `transitions` maps a state to the
// list of states it may move to; an absent/empty entry means "no guard".
// Subscribe with onChange(fn) to react to flow changes (swap update/render,
// reset a run, save, etc.).

export function createStateMachine(initial, transitions = {}) {
  let current = initial;
  const listeners = [];

  function can(next) {
    const allowed = transitions[current];
    return !allowed || allowed.includes(next);
  }

  return {
    get current() {
      return current;
    },

    can,

    transition(next) {
      if (next === current) return false;
      if (!can(next)) {
        console.warn(`[stateMachine] blocked: ${current} -> ${next}`);
        return false;
      }
      const prev = current;
      current = next;
      for (const fn of listeners) fn(current, prev);
      return true;
    },

    onChange(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
  };
}
