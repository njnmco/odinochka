
chrome.runtime.onInstalled.addListener(function(){
	// Context Menus on button
	chrome.contextMenus.create({
		  id: "odinochka_show",
		  title: "show",
		  contexts: ["browser_action"],
	});
	chrome.contextMenus.create({
          id: "odinochka_sep",
          type: "separator",
		  contexts: ["browser_action"],
	});

	chrome.contextMenus.create({
		  id: "odinochka_save_tab",
		  title: "save tab",
		  contexts: ["browser_action"],
	});
	chrome.contextMenus.create({
		  id: "odinochka_save_selected",
		  title: "save selected",
		  contexts: ["browser_action"],
	});
	chrome.contextMenus.create({
		  id: "odinochka_save_win",
		  title: "save win",
		  contexts: ["browser_action"],
	});
	chrome.contextMenus.create({
		  id: "odinochka_save_all",
		  title: "save all",
		  contexts: ["browser_action"],
	});

    // Let us open our database
    var DBOpenRequest = window.indexedDB.open("odinochka", 5);

    DBOpenRequest.onupgradeneeded = function(event) {
      var db = event.target.result;
     
      db.onerror = function(event) {
        console.log('Error loading database.');
        console.log(event);
      };

      // Create an objectStore for this database
      var objectStore = db.createObjectStore("tabgroups", { keyPath: "ts" });

      // define what data items the objectStore will index
      objectStore.createIndex("urls", "urls", {multiEntry: true});
    };
 
});



function dedupTabs(data) {
  // remove duplicates within group
  var seen = new Set();
  var toDrop = [];
  for(var i = 0; i < data.tabs.length; i++){
      if(seen.has(data.tabs[i].url)) toDrop = toDrop.concat(i)
      seen.add(data.tabs[i].url)
  }
  for(var i of toDrop.reverse()) data.tabs.splice(i,1)
  return seen;
}



function fixGreatSuspender(tab) {
    if(tab.url.startsWith("chrome-extension") &&
       tab.url.indexOf("/suspended.html#") > -1) {
            tab.url = tab.url.substr(tab.url.lastIndexOf("&uri=")+5);
    }
    return tab;
}



function saveTabs(tabs, newGroup=true, show=true) {

    if(newGroup && options.pinned == "skip") {
        tabs = tabs.filter(t => !t.pinned)
    }

    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');
        store.openCursor(null, "prev").onsuccess = function(event) {
            // Get the old value that we want to update
            var cursor = newGroup ? null : event.target.result;

            var data = cursor ? cursor.value : {
                  ts: new Date().getTime(),
                  name: "Untitled Group",
                  tabs: []
            }

            for(var tab of tabs.slice().reverse()){
                if(tab.url == "chrome://newtab/") continue;
                if(/chrome-extension:\/\/[a-z]*\/odinochka.html/.test(tab.url)) continue;
                tab = fixGreatSuspender(tab);
                data.tabs.unshift({
                  title: tab.title,
                  url:tab.url,
                  favicon:tab.favIconUrl,
                  pinned: tab.pinned
                })
            }


            // Put this updated object back into the database.
            var updateIt = function() {
                data.urls = data.tabs.map(a => a.url);
                var requestUpdate = cursor ? cursor.update(data) : store.put(data);
                requestUpdate.onsuccess = function(event) {
                    // Success - the data is updated!
                    show ? showOdinochka() : reloadOdinochka();
                    chrome.tabs.remove(tabs.map(t => t.id))
                };
            }


            if (options.dupe == "keep") {
                updateIt()
            }
            else if(options.dupe == "update") {

                var uniq = dedupTabs(data);

                var recUpdate = function(i) {
                    if(i == data.tabs.length) return updateIt();

                    store.index("urls").openCursor(data.tabs[i].url).onsuccess = function(event){
                        var tabCursor = event.target.result;
                        if(!tabCursor) return recUpdate(i + 1);

                        var dupe = tabCursor.value;

                        //will be handled by updateIt callback.
                        if(dupe.ts == data.ts) return tabCursor.continue();


                        // Remove all tabs that match
                        dupe.tabs = dupe.tabs.filter(t => !uniq.has(t.url))
                        dupe.urls = dupe.tabs.map(a => a.url);

                        dupe.tabs.length ? tabCursor.update(dupe) : tabCursor.delete();

                        tabCursor.continue();
                    }
                }

                recUpdate(0);
            }
            else if(options.dupe == "reject") {

                dedupTabs(data);

                var recUpdate = function(i) {
                    if(i == -1) {
                        return data.tabs.length && updateIt();
                    }
                    store.index("urls").getKey(data.tabs[i].url).onsuccess = function(event){
                        var tabCursor = event.target.result;
                        if(tabCursor) {
                            data.tabs.splice(i, 1);
                        }
                        recUpdate(i - 1);
                    }
                }

                recUpdate(data.tabs.length - 1);
            }
        };
    };

}

// options
var options = {}
chrome.storage.local.get({dupe: "keep", pinned: "skip"}, o => Object.assign(options, o))

chrome.storage.onChanged.addListener(function(changes, areaName) {
    if(areaName != "local") return;
    for(i in changes) options[i] = changes[i].newValue;
})


// handle clicks to our extension icon
chrome.browserAction.onClicked.addListener(tab =>
   chrome.tabs.query({windowId: tab.windowId, highlighted: true}, t => saveTabs(t, false))
);

chrome.commands.onCommand.addListener(function(command) {
    if (command == "shortcut-show") {
       showOdinochka()
    }
    if (command == "shortcut-save-win") {
       chrome.tabs.query(
           {windowId: chrome.windows.WINDOW_ID_CURRENT},
           saveTabs
       );
    }
    if (command == "shortcut-save-tab") {
       chrome.tabs.query(
         {windowId: chrome.windows.WINDOW_ID_CURRENT, active: true},
         tab => saveTabs(tab, false, false)
       );
    }
});

function showOdinochka() {
    chrome.tabs.create({ url: "odinochka.html" });
}

function reloadOdinochka() {
    chrome.tabs.query(
      { url:"chrome-extension://*/odinochka.html" },
      t => t.length && chrome.tabs.reload(t[0].id) //there should be only one.
    )
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(details, tab){
   if(details.menuItemId == "odinochka_show") {
       showOdinochka();
   }
   if(details.menuItemId == "odinochka_save_tab") {
       saveTabs([tab], false);
   }
   if(details.menuItemId == "odinochka_save_selected") {
       chrome.tabs.query(
           {windowId: tab.windowId, highlighted: true},
           saveTabs
       )
   }
   if(details.menuItemId == "odinochka_save_win") {
       chrome.tabs.query({windowId: tab.windowId}, saveTabs)
   }
   if(details.menuItemId == "odinochka_save_all") {
       chrome.windows.getAll(
           ws => ws.forEach(
               w => chrome.tabs.query({windowId: w.id}, saveTabs)
           )
       )
   }
});
