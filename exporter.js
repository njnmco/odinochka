
export function doExport(process_result) {
    let result = [];
    indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readonly');
        let store = tx.objectStore('tabgroups');

        store.openCursor(null, "prev").onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                delete cursor.value.urls;
                result.push(cursor.value);
                cursor.continue();
            }
            else {
				process_result(result)
            }
        };
    };
    return false;
}
