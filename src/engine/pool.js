// engine/pool.js
// Generic object pool. Pre-allocated objects are reused instead of being
// created/GC'd every frame, which keeps performance stable as counts grow into
// the hundreds. `factory` builds a blank object; callers re-initialize it after
// acquire() (e.g. via the entity's own reset()).
//
// `active` is exposed directly for tight iteration loops. release() uses
// swap-remove, so do not iterate `active` forward while releasing — iterate
// backward, or collect-then-release.

export function createPool(factory) {
  const free = [];
  const active = [];

  return {
    active,

    acquire() {
      const obj = free.length > 0 ? free.pop() : factory();
      active.push(obj);
      return obj;
    },

    release(obj) {
      const i = active.indexOf(obj);
      if (i === -1) return;
      active[i] = active[active.length - 1];
      active.pop();
      free.push(obj);
    },

    releaseAll() {
      while (active.length > 0) free.push(active.pop());
    },

    get activeCount() {
      return active.length;
    },
    get freeCount() {
      return free.length;
    },
  };
}
