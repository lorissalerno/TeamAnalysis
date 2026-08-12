const DB_NAME = 'TeamAnalysisDB';
const DB_VERSION = 1;

const db = {
    _db: null,

    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
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
                    db.createObjectStore('goals', { keyPath: 'id' });
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

    getSetting: function(key, defaultValue = null) {
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

    setSetting: function(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key: key, value: value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Generic get all
    getAll: function(storeName, indexName = null, indexValue = null) {
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

    // Generic add multiple items
    addMultiple: function(storeName, items) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            items.forEach(item => store.put(item));
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    },

    // Delete records from a date onwards (for CSV import replace logic)
    deleteFromDate: function(storeName, dateString, skillName = null) {
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
                        cursor.delete();
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
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
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
    }
};

window.appDb = db;
