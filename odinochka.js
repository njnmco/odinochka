
render()
initOptions()
closeOthers()

function newWindow(data) {
  chrome.windows.create({url: data.urls}, function(w) {
      var pinned = data.tabs.filter(t => t.pinned).map(t => t.url);
      if(!pinned) return;
      pinned = new Set(pinned);

      w.tabs.filter(t => pinned.has(t.url)).forEach(
        t => chrome.tabs.update(t.id, {pinned: true})
      )
  })
}

function newTabs(data) {
    data.tabs.forEach(o => chrome.tabs.create({url: o.url, pinned: o.pinned}))
}


function groupclick(event) {
    var me = event.target;
    var ts = parseInt(event.target.parentNode.id);
    var shiftclick = event.shiftKey
  
  
    if( event.clientX > event.target.offsetLeft && !shiftclick) {
        // if inside box, make editable
        if(me.contentEditable == "false"){
              me.oldText = me.innerText;
              me.contentEditable = "true";
              me.focus();
        }
        return;
    }
  
  
  
    // delete it
    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;
  
        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');
  
  
        if(!shiftclick) { // if not shift, then was x
            removeAndUpdateCount(store.delete(ts), me.parentNode)
            return;
        }
  
        store.get(ts).onsuccess = function(event) {
            var data = event.target.result;
  
            // smart selection
            var group = document.forms["options"].elements["group"].value;
            if(group == 'new') {
                newWindow(data);
            }
            else if(group == 'current') {
                newTabs(data);
            }
            else if(group == 'smart') {
                chrome.tabs.query({windowId:chrome.windows.WINDOW_ID_CURRENT, pinned: false},
                    w => w.length <= 1 ? newTabs(data) : newWindow(data)
                )
            }
  
  
            // clean up
            var restore = document.forms["options"].elements["restore"].value;
            if(restore != "keep") {
                chrome.tabs.getCurrent(t => chrome.tabs.remove(t.id));
                removeAndUpdateCount(store.delete(ts), me.parentNode);
            }
  
        }
  
  
    }
    
    
}


function groupblur(event) {
    var me = event.target;
    var ts = parseInt(event.target.parentNode.id);
  
    trimmer = function(s) {
        var i = s.indexOf("@");
        if(i != -1) s = s.substr(0, i);
        return s.trim()
    }

    if(me.contentEditable != "true") {
        return;
    }

    me.contentEditable = "false"

    var newtxt = trimmer(me.innerText);
    var oldtxt = trimmer(me.oldText);

    if(newtxt == oldtxt) return;

    
    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');

        store.get(ts).onsuccess = function(event) {
            var data = event.target.result;
            data.name = newtxt;
            store.put(data).onsuccess = (e => tabGroupLabel(me, data));
        }

    }
      
}

function removeAndUpdateCount(request, me) {
    request.onsuccess = function(event) {
        me.remove()
        updateCount(request.source)
    }
}

function tabclick(event) {

    var me = event.target;
    var ts = parseInt(me.parentNode.id);
    var url = me.href;
    var isX = event.clientX < event.target.offsetLeft; // if outside box (eg x'd) don't follow link
    var restore = document.forms["options"].elements["restore"].value;
    var pinned = me.target == "_pinned";


    if(isX || !(event.shiftKey || event.ctrlKey || (restore  == "keep"))){
        // Removes target from DB object
        window.indexedDB.open("odinochka", 5).onsuccess = function(event){
            var db = event.target.result;

            var tx = db.transaction('tabgroups', 'readwrite');
            var store = tx.objectStore('tabgroups');

            store.get(ts).onsuccess = function(event) {
                var data = event.target.result;

                if(data.urls.length == 1) {
                    removeAndUpdateCount(store.delete(ts), me.parentNode)
                }
                else {
                    data.tabs.splice(data.urls.indexOf(url), 1);
                    data.urls = data.tabs.map(a => a.url);

                    removeAndUpdateCount(store.put(data), me);
                }
            }
        }
    }//shift/ctrl if

    if(pinned) {
        chrome.tabs.create({url:url, pinned:true});
        return false;
    }

    return !isX; //only open if not X
}

function updateCount(store) {
    store.index("urls").count().onsuccess = function(e) {
        document.getElementById("size").innerText = e.target.result + " tabs";
    }
}


function initOptions() {
    var DEFAULT_OPTIONS = {
        dupe: "keep",
        restore: "remove",
        group: "smart",
        pinned: "skip"
    }

    chrome.storage.local.get(DEFAULT_OPTIONS, function(o) {
        for(var i in o) document.forms["options"].elements[i].forEach(
            e => e.checked = e.value == o[i]
        )
    })

    document.forms["options"].onchange = function (e) {
        o = {};
        o[e.target.name] = e.target.value;
        chrome.storage.local.set(o);
    }

    chrome.storage.onChanged.addListener(function(changes, areaName) {
        if(areaName != "local") return;
        for(var i in changes) document.forms["options"].elements[i].forEach(
            e => e.checked = e.value == changes[i].newValue
        )
    })

}

function closeOthers() {
    chrome.tabs.getCurrent(current =>
        chrome.tabs.query(
          { url:"chrome-extension://*/odinochka.html" },
          tabs => chrome.tabs.remove(tabs.map(t => t.id).filter(t => t != current.id))
        )
    )
}

function tabGroupLabel(header, data) {
    var prettyTime = new Date();
    prettyTime.setTime(data.ts);
    header.innerText = `${data.name} @ ${prettyTime.toUTCString()}`;
}

function render() {


    // Building tab list

    var groupdiv = document.getElementById("groups");
    while (groupdiv.firstChild) {
        groupdiv.removeChild(groupdiv.firstChild);
    }


    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');

        updateCount(store);

        store.openCursor(null, "prev").onsuccess = function(event) {
            var cursor = event.target.result;
            if(!cursor){
                return;
            }

            var data = cursor.value;


            var ddiv = document.createElement("div");
            ddiv.id = data.ts;


            var header = document.createElement("header");
            tabGroupLabel(header, data);
            header.className = "tab";
            header.ondblclick = groupclick;
            header.onblur = groupblur;
            header.contentEditable = false;
            addDragDrop(header);
            ddiv.appendChild(header);

            for(var tab of data.tabs) {
                var a = document.createElement("a");
                a.innerText = tab.title;
                a.href = tab.url;
                if(tab.favicon){
                    a.style = `--bg-favicon: url("${tab.favicon}")`;
                }
                a.className = "tab";
                a.onclick = tabclick;
                a.target = tab.pinned ? "_pinned" :  "_blank";
                addDragDrop(a);
                ddiv.appendChild(a);
            }

            groupdiv.appendChild(ddiv);
            cursor.continue();

        };
    };

}

// Drag and Drop

function addDragDrop(a) {
    a.draggable = true;
    a.ondragstart = dragstart
    a.ondragend = dragend
    a.ondragover = dragover
    a.ondrop = drop
}

function dragstart(event) {
    event.target.id = "drag";
}

function dragover(event) {
    event.preventDefault()
}

function dragend(event) {
    event.target.id = ""
}

function drop(event) {
    event.preventDefault();

    var src = document.getElementById("drag");
    var tgt = event.target;

    if(src == tgt) return;


    var srcId = parseInt(src.parentNode.id);
    var tgtId = parseInt(tgt.parentNode.id);
    var srcIndex = Array.from(src.parentNode.children).indexOf(src) - 1; // -1 to adjust for header tag
    var tgtIndex = Array.from(tgt.parentNode.children).indexOf(tgt) - 1;
    var srcGroup = src.tagName  == "HEADER"
    var tgtGroup = tgt.tagName  == "HEADER"

    if(srcGroup && !tgtGroup) return; // appending group to link makes no sense.

    var moveNode = function() {
        tgt.parentNode.insertBefore(src, tgt.nextSibling);
    }

    //console.log({src:src, tgt:tgt, srcId:srcId, tgtId:tgtId, srcIndex:srcIndex, tgtIndex:tgtIndex})


    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');

        store.get(tgtId).onsuccess = function(event1) {
            if (tgtId == srcId) {
                var tdata = event1.target.result;
                tdata.tabs.splice(tgtIndex + 1, 0, tdata.tabs[srcIndex]);
                tdata.tabs.splice(srcIndex + (srcIndex > tgtIndex), 1);
                tdata.urls = tdata.tabs.map(t => t.url);
                //console.log(tdata.urls)


                store.put(tdata).onsuccess = moveNode;
                return;
            }
            // otherwise, cross group drag and drop
            store.get(srcId).onsuccess = function(event2) {
                var tdata = event1.target.result;
                var sdata = event2.target.result;
                var callback;

                if(srcGroup && tgtGroup) {
                    tdata.tabs = tdata.tabs.concat(sdata.tabs);
                    sdata.tabs = []
                    callback = function() {
                        while(src.nextSibling) {
                            tgt.parentNode.appendChild(src.nextSibling);
                        }
                    }
                } else {
                    tdata.tabs.splice(tgtIndex, 0, sdata.tabs[srcIndex]);
                    sdata.tabs.splice(srcIndex, 1);
                    callback = moveNode
                }

                tdata.urls = tdata.tabs.map(t => t.url);
                sdata.urls = sdata.tabs.map(t => t.url);

                store.put(tdata).onsuccess = function(event) {

                    if(sdata.tabs.length == 0) {
                        store.delete(sdata.ts).onsuccess = function(event) {
                            var oldParent = src.parentNode;
                            callback();
                            oldParent.remove();
                        }
                    }
                    else {
                        store.put(sdata).onsuccess = callback;
                    }

                }
            }

        }


    };
}
