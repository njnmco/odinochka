
chrome.runtime.onInstalled.addListener(function(){
	// Context Menus on button
	chrome.contextMenus.create({
		  id: "odinochka_save_tab",
		  title: "save tab",
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

// Listeners

// handle clicks to our extension icon
chrome.browserAction.onClicked.addListener(function(tab) {
	// simply go to our search history page in a new tab
    console.log(tab)

    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');
        store.openCursor().onsuccess = function(event) {
          // Get the old value that we want to update
          var cursor = event.target.result;

          var data = cursor ? cursor.value : {
                ts: new Date().getTime(),
                name: "Untitled Group",
                tabs: []
          }

          data.tabs.unshift({
            title: tab.title,
            url:tab.url,
            favicon:tab.favIconUrl,
            pinned: tab.pinned
          })

          data.urls = data.tabs.map(a => a.url);

          // Put this updated object back into the database.
          var requestUpdate = cursor ? cursor.update(data) : store.put(data);
          requestUpdate.onsuccess = function(event) {
              chrome.tabs.remove(tab.id)
              // Success - the data is updated!
              chrome.tabs.create({
               url: "odinochka.html"
              });
          };
        };
        //inside db
    };

});


// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(details, tab){
   alert(details.menuItemId);
   console.log(tab);
});


var db;
// Let us open our database
var DBOpenRequest = window.indexedDB.open("odinochka", 5);

// Two event handlers for opening the database.
DBOpenRequest.onerror = function(event) {
  console.log('Error loading database.');
  console.log(event);
};

DBOpenRequest.onsuccess = function(event) {
  console.log('<li>Database initialised.');
 
  // store the result of opening the database in the db variable.
  // This is used a lot below.
  db = event.target.result;
  db.onerror = function(event) {
    console.log('DB Error');
    console.log(event);
  };
 
  // Run the displayData() function to populate the task list with
  // all the to-do list data already in the IDB
};

// This handler fires when a new database is created and indicates
// either that one has not been created before, or a new version
// was submitted with window.indexedDB.open(). (See above.)
// It is only implemented in recent browsers.
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
