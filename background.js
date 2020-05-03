
chrome.runtime.onInstalled.addListener(function(){
	// Context Menus on button
    // Limited to six - see also chrome.contextMenus.ACTION_MENU_TOP_LEVEL_LIMIT    
	chrome.contextMenus.create({
		  id: "odinochka_show",
		  title: "show",
		  contexts: ["browser_action"],
	});
	chrome.contextMenus.create({
		  id: "odinochka_help",
		  title: "help",
		  contexts: ["browser_action"],
	});
	chrome.contextMenus.create({
          id: "odinochka_sep",
          type: "separator",
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

    // On page
	chrome.contextMenus.create({
		  id: "odinochka_save_link",
		  title: "save link",
		  contexts: ["link"],
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
 
    chrome.tabs.create({ url: "help.html" })

});



function dedupTabs(data) {
  // remove duplicates within group
  let seen = new Set();
  let toDrop = [];
  for(let i = 0; i < data.tabs.length; i++){
      if(seen.has(data.tabs[i].url)) toDrop = toDrop.concat(i)
      seen.add(data.tabs[i].url)
  }
  let dup = toDrop.reverse().map( i => data.tabs.splice(i,1)[0].url);
  return seen;
}



function cleanTabData(tab) {
    if(tab.url.startsWith("chrome-extension") &&
       tab.url.indexOf("/suspended.html#") > -1) {
            tab.url = tab.url.substr(tab.url.lastIndexOf("&uri=")+5);
    }
    tab.url = tab.url.replace(/([?&])utm_[^=]*=[^&]*/g, "$1");
    if(tab.favIconUrl.startsWith("chrome-extension")) delete tab.favIconUrl;
    return tab;
}


function saveTabs(tabs, newGroup=true, show=true) {

    if(newGroup && options.pinned == "skip") {
        tabs = tabs.filter(t => !t.pinned)
    }

    let o_pattern = /chrome-extension:\/\/[a-z]*\/odinochka.html/;
    tabs = tabs.filter(t => !o_pattern.test(t.url));

    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readwrite');
        let store = tx.objectStore('tabgroups');
        store.openCursor(null, "prev").onsuccess = function(event) {
            // Get the old value that we want to update
            let cursor = newGroup ? null : event.target.result;

            let data = cursor ? cursor.value : {
                  ts: new Date().getTime(),
                  name: "Untitled Group",
                  tabs: []
            }

            let origUrls = new Set(data.urls);

            for(let tab of tabs.slice().reverse()){
                if(tab.url == "chrome://newtab/") continue;
                tab = cleanTabData(tab);
                data.tabs.unshift({
                  title: tab.title,
                  url:tab.url,
                  favicon:tab.favIconUrl,
                  pinned: tab.pinned
                })
            }

            let alsoUpdate = {};
            let closeTabs = function(event) {
                let cb = () => chrome.tabs.remove(tabs.map(t => t.id))
                data.update = alsoUpdate;
                show ? showOdinochka(cb, data) : reloadOdinochka(cb, data);
            };

            if(newGroup && data.tabs.length == 0) return closeTabs();

            // Put this updated object back into the database.
            let updateIt = function() {
                data.urls = data.tabs.map(a => a.url);
                var req = cursor ? cursor.update(data) : store.put(data);
                req.onsuccess = closeTabs;
            }


            if (options.dupe == "keep") {
                return updateIt();
            }
            else if(options.dupe == "update") {

                let uniq = dedupTabs(data);

                let recUpdate = function(i) {
                    while (i < data.tabs.length && origUrls.has(data.tabs[i].url)) i = i + 1;
                    if(i == data.tabs.length) return updateIt();

                    store.index("urls").openCursor(data.tabs[i].url).onsuccess = function(event){
                        let tabCursor = event.target.result;
                        if(!tabCursor) return recUpdate(i + 1);

                        let dupe = tabCursor.value;

                        //should never happen
                        if(dupe.ts == data.ts) {
                            console.log({dupe:dupe, data:data, origUrls:origUrls, i:i})
                            return tabCursor.continue();
                        }


                        // Remove all tabs that match
                        dupe.tabs = dupe.tabs.filter(t => !uniq.has(t.url))
                        dupe.urls = dupe.tabs.map(a => a.url);

                        let req = dupe.tabs.length ? tabCursor.update(dupe) : tabCursor.delete();
                        alsoUpdate[dupe.ts] = dupe.tabs.length ? dupe : 'd';

                        req.onsuccess = () => tabCursor.continue();
                    }
                }

                return recUpdate(0);
            }
            else if(options.dupe == "reject") {

                dedupTabs(data);

                let recUpdate = function(i) {
                    while (i >= 0 && origUrls.has(data.tabs[i].url)) i = i - 1;
                    if(i == -1) {
                        // don't create empty group
                        return !newGroup || data.length > 0 ? updateIt() : closeTabs();
                    }

                    store.index("urls").getKey(data.tabs[i].url).onsuccess = function(event){
                        let tabCursor = event.target.result;
                        if(tabCursor) {
                            data.tabs.splice(i, 1);
                        }
                        recUpdate(i - 1);
                    }
                }

                return recUpdate(data.tabs.length - 1);
            }
        };
    };

}

// options
var options = {}
chrome.storage.local.get(
    {dupe: "keep", pinned: "skip", advanced: "", grabfocus: "always"},
    o => Object.assign(options, o) && doAdvanced(o.advanced)
)

chrome.storage.onChanged.addListener(function(changes, areaName) {
    if(areaName != "local") return;
    for(let i in changes) options[i] = changes[i].newValue;
    doAdvanced(options.advanced);
})


// handle clicks to our extension icon
chrome.browserAction.onClicked.addListener(tab => command_handler("odinochka_save_selected"));

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((details, tab) => command_handler(details.menuItemId, true, details));

chrome.commands.onCommand.addListener(command_handler);

function command_handler(command, showOnSingleTab=false, details=null){
    if (command == "odinochka_show") {
       showOdinochka()
    }
    if (command == "odinochka_help") {
       chrome.tabs.create({ url: "help.html" })
    }
    if (command == "odinochka_save_tab") {
       chrome.tabs.query(
         {windowId: chrome.windows.WINDOW_ID_CURRENT, active: true},
         tab => saveTabs(tab, false, showOnSingleTab)
       );
    }
    if (command == "odinochka_save_selected") {
        chrome.tabs.query(
            {windowId: chrome.windows.WINDOW_ID_CURRENT, highlighted: true},
            saveTabs
        )
    }
    if (command == "odinochka_save_win") {
       chrome.tabs.query(
           {windowId: chrome.windows.WINDOW_ID_CURRENT},
           saveTabs
       );
    }
    if (command == "odinochka_save_all") {
        chrome.windows.getAll(
            ws => ws.forEach(
                w => chrome.tabs.query({windowId: w.id}, saveTabs)
            )
        )
    }
    if (command == "odinochka_save_link") {
        saveTabs([{title: details.linkUrl, url:details.linkUrl, favicon:"", pinned:false}], false, false)
    }
}

function showOdinochka(callback = null, data={}) {
    chrome.tabs.query(
      { url:"chrome-extension://*/odinochka.html" },
      t => {
          if(!t.length) return( chrome.tabs.create({ url: "odinochka.html" }, callback) )
          var otab = t[0];

          var dontgrab = options.grabfocus == 'never' ||  (otab.pinned && options.grabfocus == 'unpinned');
          //console.log({'dontgrab':dontgrab, 'opt':options.grabfocus, otab: otab})

          // if not grabbing focus, fire callback directly
          var cb = dontgrab ? callback : () => chrome.tabs.move(
              otab.id,
              {windowId:chrome.windows.WINDOW_ID_CURRENT, index:-1},
              () => chrome.tabs.update(otab.id, {active:true},  callback)
          )

          chrome.tabs.sendMessage(otab.id, data, cb);
      }
    )
    
}

function reloadOdinochka(callback, data={}) {
    chrome.tabs.query(
      { url:"chrome-extension://*/odinochka.html" },
      t => t.length ? chrome.tabs.sendMessage(t[0].id, data, callback) : callback() //there should be only one.
    )
}

// Automated backup to s3
function postTabs(url, method, alarm) {
    let result = [];
    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;
        let tx = db.transaction('tabgroups', 'readonly');
        let store = tx.objectStore('tabgroups');

        store.openCursor(null, "prev").onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                result.push(cursor.value);
                cursor.continue();
            }
            else {
                console.log({date: new Date(), numGroups: result.length});
                var xhr = new XMLHttpRequest();
                xhr.open(method, url, true);
                xhr.send(JSON.stringify(result));
            }
        }
    }
}
 
let alarmCallback = null;
function doAdvanced(advanced) {
    chrome.alarms.onAlarm.removeListener(alarmCallback);
    alarmCallback = null;
    if( /I know what I'm doing/.test(advanced)) {
        let advancedOptions = JSON.parse(advanced);
        console.log(advancedOptions);
        chrome.alarms.create("odinochka", {delayInMinutes:1, periodInMinutes: advancedOptions.interval});
        alarmCallback = postTabs.bind(null, advancedOptions.url, advancedOptions.method);
        chrome.alarms.onAlarm.addListener(alarmCallback);
    }
}
