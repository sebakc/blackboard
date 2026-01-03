const fs = require('fs').promises;
const path = require('path');

class VersionedStore {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.locks = new Map(); // id -> Promise (mutex for serialization)
    // Ensure base directory exists
    fs.mkdir(baseDir, { recursive: true }).catch(() => {});
  }

  _getFilePath(id) {
    return path.join(this.baseDir, `${id}.json`);
  }

  /**
   * serialization wrapper to ensure only one operation runs per ID at a time.
   */
  async _withLock(id, fn) {
    const prev = this.locks.get(id) || Promise.resolve();
    
    const nextPromise = (async () => {
      try {
        await prev.catch(() => {}); // Wait for previous to settle
        return await fn();
      } finally {
        // Cleanup if this is the last promise in the chain
        if (this.locks.get(id) === nextPromise) {
          this.locks.delete(id);
        }
      }
    })();

    this.locks.set(id, nextPromise);
    return nextPromise;
  }

  /**
   * Reads the current record.
   */
  async get(id) {
    try {
      const content = await fs.readFile(this._getFilePath(id), 'utf8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Updates the record with optimistic locking.
   * @param {string} id - The record ID
   * @param {number} expectedVersion - The version the client thinks it is updating
   * @param {object} newData - The new data payload
   */
  async update(id, expectedVersion, newData) {
    return this._withLock(id, async () => {
      const current = await this.get(id);
      
      let currentVersion = 0;
      if (current) {
        currentVersion = current.version;
      }

      // Conflict Check
      if (currentVersion !== expectedVersion) {
        const error = new Error(`Conflict: Expected version ${expectedVersion}, but found ${currentVersion}`);
        error.code = 'CONFLICT';
        error.currentVersion = currentVersion;
        throw error;
      }

      // Create new record
      const record = {
        id,
        version: currentVersion + 1,
        data: newData,
        updatedAt: Date.now()
      };

      // Atomic Write (Atomic in the sense of file system flush, serialized by lock)
      await fs.writeFile(this._getFilePath(id), JSON.stringify(record, null, 2));
      return record;
    });
  }
}

module.exports = VersionedStore;
