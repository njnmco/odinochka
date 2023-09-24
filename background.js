function contextMenus() {
    // Context Menus on button
    // Limited to six - see also chrome.contextMenus.ACTION_MENU_TOP_LEVEL_LIMIT    

    // Context Menus
    chrome.contextMenus.create({
          id: "odinochka_show",
          title: "show",
          contexts: ["action"],
    });
    chrome.contextMenus.create({
          id: "odinochka_help",
          title: "help",
          contexts: ["action"],
    });
    chrome.contextMenus.create({
          id: "odinochka_sep",
          type: "separator",
          contexts: ["action"],
    });
    chrome.contextMenus.create({
          id: "odinochka_save_win",
          title: "save win",
          contexts: ["action"],
    });
    chrome.contextMenus.create({
          id: "odinochka_save_all",
          title: "save all",
          contexts: ["action"],
    });

    // On page
    chrome.contextMenus.create({
          id: "odinochka_save_link",
          title: "save link",
          contexts: ["link"],
    });
}

// ---------------------------------------------------

chrome.runtime.onInstalled.addListener(function(){

    contextMenus();

    // Let us open our database
    var DBOpenRequest = indexedDB.open("odinochka", 5);

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
      chrome.tabs.create({ url: "help.html" })
    };


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
    if(tab.faviconUrl && tab.favIconUrl.startsWith("chrome-extension")) delete tab.favIconUrl;
    return tab;
}

async function saveTabsByGroup(tabs) {
    let groups = {};
    
    for(let t of tabs) {
        if(t.groupId in groups) {
            groups[t.groupId].push(t);
        } else {
            groups[t.groupId] = [ t ];
        }
    }

    // NB above is converting ids into strings for some reason?
    for(let i in groups) {
        let title = '';
        if( i != "-1") {
            let group = await chrome.tabGroups.get(parseInt(i));
            title = group.title;
        }
        groups[i] = saveTabs(groups[i], true, false, title);
    }

    await Promise.all(Object.values(groups));

    showOdinochka()

}

async function saveTabs(tabs, newGroup=true, show=true, tabGroupTitle=null) {
    let options = await getData();

    if(newGroup && options.pinned == "skip") {
        tabs = tabs.filter(t => !t.pinned)
    }

    if(newGroup && options.audible == "skip") {
        tabs = tabs.filter(t => !t.audible)
    }

    let o_pattern = /chrome-extension:\/\/[a-z]*\/odinochka.html/;
    tabs = tabs.filter(t => !o_pattern.test(t.url));

    indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readwrite');
        let store = tx.objectStore('tabgroups');
        store.openCursor(null, "prev").onsuccess = function(event) {
            // Get the old value that we want to update
            let cursor = newGroup ? null : event.target.result;

            let data = cursor ? cursor.value : {
                  ts: new Date().getTime(),
                  name: tabGroupTitle || "Untitled Group",
                  tabs: []
            }

            let origUrls = new Set(data.urls);

            for(let tab of tabs.slice().reverse()){
                if(tab.url == "chrome://newtab/") continue;
                tab = cleanTabData(tab);
                data.tabs.unshift({
                  title: tab.title,
                  url:tab.url,
                  //favicon:tab.favIconUrl,
                  pinned: tab.pinned
                })
            }

            // if all tabs were filtered out, bail
            if(newGroup && data.tabs.length == 0) {
                if(show) showOdinochka(cb, {});
                return;
            }

            let alsoUpdate = {};
            let closeTabs = function(event) {
                var close_tabs = tabs;
                if(options.audible == "leave") {
                    close_tabs = close_tabs.filter(t => !t.audible)
                }

                let ids = close_tabs.map(t => t.id).filter(Number);
                let cb = () => chrome.tabs.remove(ids);
                data.update = alsoUpdate;
                show ? showOdinochka(cb, data) : reloadOdinochka(cb, data);
            };


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

// https://stackoverflow.com/a/49595052/986793
function getData() {
  let sKey =  {dupe: "keep", pinned: "skip", audible: "close", grabfocus: "always", tabGroupCloseAction:"autosave"};
  return new Promise(function(resolve, reject) {
    chrome.storage.local.get(sKey, function(items) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(items);
      }
    });
  });
}


// handle clicks to our extension icon
chrome.action.onClicked.addListener(tab => command_handler("odinochka_save_selected"));

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((details, tab) => command_handler(details.menuItemId, true, details));

chrome.commands.onCommand.addListener(command_handler);

async function command_handler(command, showOnSingleTab=false, details=null){
    if (command == "odinochka_show") {
       showOdinochka()
    }
    if (command == "odinochka_help") {
       chrome.tabs.create({ url: "help.html" })
    }
    if (command == "odinochka_save_tab") {
       chrome.tabs.query(
         {currentWindow:true, active: true},
         tab => saveTabs(tab, false, showOnSingleTab)
       );
    }
    if (command == "odinochka_save_selected") {
        chrome.tabs.query(
            {currentWindow: true, highlighted: true},
            saveTabsByGroup
        )
    }
    if (command == "odinochka_save_win") {
       chrome.tabs.query(
           {currentWindow: true},
           saveTabsByGroup
       );
    }
    if (command == "odinochka_save_all") {
        chrome.windows.getAll(
            ws => ws.forEach(
                w => chrome.tabs.query({windowId: w.id}, saveTabsByGroup)
            )
        )
    }
    if (command == "odinochka_save_link") {
        saveTabs([{title: details.linkUrl, url:details.linkUrl, favicon:"", pinned:false}], false, false)
    }
}


async function showOdinochka(callback = null, data={}) {
    let options = await getData();
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
      t => t.length ? chrome.tabs.sendMessage(t[0].id, data, callback) : callback ? callback() : null  //there should be only one.
    )
}

