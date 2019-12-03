
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
});

// Listeners

// handle clicks to our extension icon
chrome.browserAction.onClicked.addListener(function() {
	// simply go to our search history page in a new tab
	chrome.tabs.create({
		url: "odinochka.html"
	});
});


// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(details, tab){
   alert(details.menuItemId);
   console.log(tab);
});


var db;
// Let us open our database
var DBOpenRequest = window.indexedDB.open("odinochka", 4);

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
  var objectStore = db.createObjectStore("tabgroupps", { keyPath: "ts" });

  // define what data items the objectStore will contain
    
  objectStore.createIndex("ts", "ts", { unique: false });
  objectStore.createIndex("href", "href", { unique: false });
};
