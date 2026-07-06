// engine/spatialgrid.js
// Uniform spatial hash for cheap neighbor queries. Rebuilt each frame: clear(),
// insert() every item, then read buckets via bucketAt(). Used now for enemy
// separation; will be reused for combat broad-phase collision (build step 6).
//
// Bucket access is exposed directly (no per-call callbacks) so hot loops over
// hundreds of items don't allocate closures.

export function createSpatialGrid(cellSize) {
  const cells = new Map();

  // Pack signed cell coords into one numeric key. Safe while |cy| < 100000,
  // which holds for any reasonable world / cell size.
  const keyOf = (cx, cy) => cx * 100000 + cy;

  return {
    cellSize,

    clear() {
      cells.clear();
    },

    cellCoord(v) {
      return Math.floor(v / cellSize);
    },

    insert(item) {
      const cx = Math.floor(item.x / cellSize);
      const cy = Math.floor(item.y / cellSize);
      const k = keyOf(cx, cy);
      let bucket = cells.get(k);
      if (bucket === undefined) {
        bucket = [];
        cells.set(k, bucket);
      }
      bucket.push(item);
    },

    // Returns the items array for a cell, or undefined if empty.
    bucketAt(cx, cy) {
      return cells.get(keyOf(cx, cy));
    },
  };
}
