const DB_NAME = 'TeamAnalysisDB';
const DB_VERSION = 4;

const db = {
    _db: null,

    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                // Performance store: id, year, date, employee, data{}
                if (!db.objectStoreNames.contains('performance')) {
                    const perfStore = db.createObjectStore('performance', { keyPath: 'id', autoIncrement: true });
                    perfStore.createIndex('year', 'year', { unique: false });
                    perfStore.createIndex('date', 'date', { unique: false });
                }
                // Sales store: id, year, date, employee, data{}
                if (!db.objectStoreNames.contains('sales')) {
                    const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                    salesStore.createIndex('year', 'year', { unique: false });
                    salesStore.createIndex('date', 'date', { unique: false });
                }
                // Anonymous mapping: id, year, realName, anonId
                if (!db.objectStoreNames.contains('anonymous_map')) {
                    const anonStore = db.createObjectStore('anonymous_map', { keyPath: 'id', autoIncrement: true });
                    anonStore.createIndex('year', 'year', { unique: false });
                }
                // Widgets
                if (!db.objectStoreNames.contains('dashboard_widgets')) {
                    db.createObjectStore('dashboard_widgets', { keyPath: 'id' }); // id can be string generated
                }
                // Custom Stats
                if (!db.objectStoreNames.contains('custom_stats')) {
                    db.createObjectStore('custom_stats', { keyPath: 'id' });
                }
                // Goals
                if (!db.objectStoreNames.contains('goals')) {
                    const goalsStore = db.createObjectStore('goals', { keyPath: 'id' });
                    goalsStore.createIndex('year', 'year', { unique: false });
                }
                // Import Logs Store
                if (!db.objectStoreNames.contains('import_logs')) {
                    const logStore = db.createObjectStore('import_logs', { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Migration v1 -> v2: add year index to goals if store already exists
                if (oldVersion < 2 && db.objectStoreNames.contains('goals')) {
                    const goalsStore = event.currentTarget.transaction.objectStore('goals');
                    if (!goalsStore.indexNames.contains('year')) {
                        goalsStore.createIndex('year', 'year', { unique: false });
                    }
                }

                // Migration v3 -> v4: add dedupKey index to performance and sales
                if (oldVersion < 4) {
                    ['performance', 'sales'].forEach(storeName => {
                        if (db.objectStoreNames.contains(storeName)) {
                            const store = event.currentTarget.transaction.objectStore(storeName);
                            if (!store.indexNames.contains('dedupKey')) {
                                store.createIndex('dedupKey', 'dedupKey', { unique: false });
                            }
                            // Backfill dedupKey on existing records
                            const cursorReq = store.openCursor();
                            cursorReq.onsuccess = (event) => {
                                const cursor = event.target.result;
                                if (cursor) {
                                    const item = cursor.value;
                                    if (!item.dedupKey) {
                                        item.dedupKey = db.buildDedupKey(item);
                                        cursor.update(item);
                                    }
                                    cursor.continue();
                                }
                            };
                        }
                    });
                }
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                reject('Error opening DB: ' + event.target.error);
            };
        });
    },

    _ensureDb: async function() {
        if (!this._db) {
            await this.init();
        }
    },

    getSetting: async function(key, defaultValue = null) {
        await this._ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : defaultValue);
            };
            request.onerror = () => reject(request.error);
        });
    },

    setSetting: async function(key, value) {
        await this._ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key: key, value: value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Generic get all
    getAll: async function(storeName, indexName = null, indexValue = null) {
        await this._ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            let request;
            
            if (indexName && indexValue !== null) {
                const index = store.index(indexName);
                request = index.getAll(IDBKeyRange.only(indexValue));
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Build a deduplication key for a performance/sales record
    buildDedupKey: function(item) {
        const employee = (item.employee || '').trim();
        const date = item.date || '';
        const skill = (item.skill || '');
        if (item.category === 'sales' || item.data && item.data.Product) {
            const product = (item.data && item.data.Product) || skill;
            return `sales|${employee}|${date}|${product}`;
        }
        return `perf|${employee}|${date}|${skill}`;
    },

    // Generic add multiple items (deduplicates on dedupKey for performance/sales)
    addMultiple: async function(storeName, items) {
        await this._ensureDb();
        const readStore = this._db.transaction([storeName], 'readonly').objectStore(storeName);

        if (!readStore.indexNames.contains('dedupKey')) {
            return new Promise((resolve, reject) => {
                const transaction = this._db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                items.forEach(item => store.put(item));

                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        }

        const existingKeys = new Set();
        const index = readStore.index('dedupKey');
        const keyRequest = index.openCursor();
        await new Promise((resolve, reject) => {
            keyRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    existingKeys.add(cursor.key);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            keyRequest.onerror = () => reject(keyRequest.error);
        });

        const toAdd = [];
        const batchKeys = new Set();
        let skipped = 0;
        items.forEach(item => {
            const key = this.buildDedupKey(item);
            if (existingKeys.has(key) || batchKeys.has(key)) {
                skipped++;
                return;
            }
            item.dedupKey = key;
            batchKeys.add(key);
            toAdd.push(item);
        });

        if (toAdd.length === 0) {
            return skipped;
        }

        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const writeStore = transaction.objectStore(storeName);
            toAdd.forEach(item => writeStore.put(item));

            transaction.oncomplete = () => resolve(skipped);
            transaction.onerror = () => reject(transaction.error);
        });
    },

    // Delete records from a date onwards (for CSV import replace logic)
    deleteFromDate: async function(storeName, dateString, skillName = null) {
        await this._ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index('date');
            
            // Delete anything >= dateString
            const range = IDBKeyRange.lowerBound(dateString);
            const request = index.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const item = cursor.value;
                    if (!skillName || item.skill === skillName) {
                        if (item.isManual) {
                            if (item.data && item.manualMetrics) {
                                let hasNonManual = false;
                                Object.keys(item.data).forEach(k => {
                                    if (storeName === 'sales' && k === 'Product') return;
                                    if (!item.manualMetrics[k]) {
                                        delete item.data[k];
                                        hasNonManual = true;
                                    }
                                });
                                const keys = Object.keys(item.data);
                                if (keys.length === 0 || (storeName === 'sales' && keys.length === 1 && keys[0] === 'Product')) {
                                    cursor.delete();
                                } else if (hasNonManual) {
                                    cursor.update(item);
                                }
                            }
                        } else {
                            cursor.delete();
                        }
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    },

    deleteRecord: function(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    putRecord: function(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    updateRecord: function(storeName, item) {
        return this.putRecord(storeName, item);
    },

    deleteBySkill: function(storeName, skillName, year = null) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const val = cursor.value;
                    if (val.skill === skillName && (!year || val.year === year)) {
                        if (val.isManual) {
                            if (val.data && val.manualMetrics) {
                                let hasNonManual = false;
                                Object.keys(val.data).forEach(k => {
                                    if (storeName === 'sales' && k === 'Product') return;
                                    if (!val.manualMetrics[k]) {
                                        delete val.data[k];
                                        hasNonManual = true;
                                    }
                                });
                                const keys = Object.keys(val.data);
                                if (keys.length === 0 || (storeName === 'sales' && keys.length === 1 && keys[0] === 'Product')) {
                                    cursor.delete();
                                } else if (hasNonManual) {
                                    cursor.update(val);
                                }
                            }
                        } else {
                            cursor.delete();
                        }
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    },

    renameSkill: async function(oldName, newName) {
        const perf = await this.getAll('performance');
        const perfToUpdate = perf.filter(p => p.skill === oldName);
        if (perfToUpdate.length > 0) {
            const transaction = this._db.transaction(['performance'], 'readwrite');
            const store = transaction.objectStore('performance');
            perfToUpdate.forEach(p => {
                p.skill = newName;
                store.put(p);
            });
        }
        const stats = await this.getAll('custom_stats');
        const statsToUpdate = stats.filter(s => s.skill === oldName);
        if (statsToUpdate.length > 0) {
            const transaction = this._db.transaction(['custom_stats'], 'readwrite');
            const store = transaction.objectStore('custom_stats');
            statsToUpdate.forEach(s => {
                s.skill = newName;
                store.put(s);
            });
        }
        const goals = await this.getAll('goals');
        const goalsToUpdate = goals.filter(g => g.skill === oldName);
        if (goalsToUpdate.length > 0) {
            const transaction = this._db.transaction(['goals'], 'readwrite');
            const store = transaction.objectStore('goals');
            goalsToUpdate.forEach(g => {
                g.skill = newName;
                store.put(g);
            });
        }
    },
    
    // Backup entire DB to JSON
    exportJSON: async function() {
        const stores = ['settings', 'performance', 'sales', 'anonymous_map', 'dashboard_widgets', 'custom_stats', 'goals'];
        const backup = {};
        
        for (const storeName of stores) {
            backup[storeName] = await this.getAll(storeName);
        }
        
        return JSON.stringify(backup);
    },
    
    // Import from JSON
    importJSON: async function(jsonString) {
        const backup = JSON.parse(jsonString);
        const stores = Object.keys(backup);
        
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(stores, 'readwrite');
            
            stores.forEach(storeName => {
                const store = transaction.objectStore(storeName);
                store.clear(); // Clear existing
                backup[storeName].forEach(item => store.put(item));
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    },

    addImportLog: function(text, isError = false, type = 'Import') {
        return new Promise((resolve, reject) => {
            if (!this._db || !this._db.objectStoreNames.contains('import_logs')) {
                resolve();
                return;
            }
            const tx = this._db.transaction(['import_logs'], 'readwrite');
            const store = tx.objectStore('import_logs');
            const logEntry = {
                timestamp: Date.now(),
                dateStr: new Date().toLocaleString(),
                text: text,
                isError: !!isError,
                type: type
            };
            store.add(logEntry);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    getImportLogs: function() {
        return this.getAll('import_logs');
    },

    cleanOldImportLogs: async function(days = 7) {
        if (!this._db || !this._db.objectStoreNames.contains('import_logs')) return 0;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const logs = await this.getAll('import_logs');
        const oldLogs = logs.filter(l => (l.timestamp || 0) < cutoff);

        if (oldLogs.length > 0) {
            const tx = this._db.transaction(['import_logs'], 'readwrite');
            const store = tx.objectStore('import_logs');
            oldLogs.forEach(l => store.delete(l.id));
            await new Promise(resolve => { tx.oncomplete = resolve; });
        }
        return oldLogs.length;
    }
};

window.appDb = db;
