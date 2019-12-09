
chrome.runtime.onInstalled.addListener(function(){
	// Context Menus on button
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
	chrome.contextMenus.create({
		  id: "odinochka_show",
		  title: "show",
		  contexts: ["browser_action"],
	});

    // Let us open our database
    var DBOpenRequest = window.indexedDB.open("odinochka", 5);

    // Two event handlers for opening the database.
    DBOpenRequest.onerror = function(event) {
      console.log('Error loading database.');
      console.log(event);
    };

    DBOpenRequest.onsuccess = function(event) {
      console.log('<li>Database initialised.');
    };

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

function saveTabs(tabs, newWin=true) {

    fixGreatSuspender = function(tab) {
        if(tab.url.startsWith("chrome-extension") &&
           tab.url.indexof("/suspended.html#") > -1) {
                tab.url = tab.url.substr(tab.url.lastIndexOf("&uri=")+5);
        }
        return tab;
    }


    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');
        store.openCursor(null, "prev").onsuccess = function(event) {
          // Get the old value that we want to update
          var cursor = newWin ? null : event.target.result;

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

          data.urls = data.tabs.map(a => a.url);

          // Put this updated object back into the database.
          var requestUpdate = cursor ? cursor.update(data) : store.put(data);
          requestUpdate.onsuccess = function(event) {
              // Success - the data is updated!
              chrome.tabs.create({
               url: "odinochka.html"
              });
              tabs.map(t => chrome.tabs.remove(t.id))
          };
        };
        //inside db
    };



}

// handle clicks to our extension icon
chrome.browserAction.onClicked.addListener(tab => saveTabs([tab], false));


// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(details, tab){
   if(details.menuItemId == "odinochka_show") {
       chrome.tabs.create({ url: "odinochka.html" });
   }
   if(details.menuItemId == "odinochka_save_tab") {
       saveTabs([tab], false);
   }
   if(details.menuItemId == "odinochka_save_selected") {
       chrome.tabs.query({windowId: tab.windowId, highlighted: true}, saveTabs)
   }
   if(details.menuItemId == "odinochka_save_win") {
       chrome.tabs.query({windowId: tab.windowId}, saveTabs)
   }
   if(details.menuItemId == "odinochka_save_all") {
       chrome.windows.getAll(w => chrome.tabs.query({windowId: w.id}, saveTabs))
   }

});
