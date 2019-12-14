
render()
initOptions()
closeOthers()

function newWindow(data) {
  chrome.windows.create({url: data.urls}, function(w) {
      w.tabs.filter((t,i) => data.tabs[i].pinned).forEach(
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
    var isX = event.clientX < me.offsetLeft; // if outside box (eg x'd) don't follow link
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
    let DEFAULT_OPTIONS = {
        dupe: "keep",
        restore: "remove",
        group: "smart",
        pinned: "skip"
    }

    chrome.storage.local.get(DEFAULT_OPTIONS, function(o) {
        for(let i in o) document.forms["options"].elements[i].forEach(
            e => e.checked = e.value == o[i]
        )
    })

    document.forms["options"].onchange = function (e) {
        let o = {};
        o[e.target.name] = e.target.value;
        chrome.storage.local.set(o);
    }

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
    let prettyTime = new Date();
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

function ddextract(node) {
    return {
        node: node,
        parentNode: node.parentNode,
        id: parseInt(node.parentNode.id),
        index: Array.from(node.parentNode.children).indexOf(node) - 1, // -1 to adjust for header tag
        group: node.tagName == "HEADER"
    }
}

function drop(event) {
    event.preventDefault();

    if(event.target.id == "drag") return; // dropped on itself

    let src = ddextract(document.getElementById("drag"));
    let tgt = ddextract(event.target);

    if(src.group && !tgt.group) return; // appending group to link makes no sense.

    let moveNode = function() {
        tgt.parentNode.insertBefore(src.node, tgt.node.nextSibling);
    }

    //console.log({src:src, tgt:tgt, srcId:srcId, tgtId:tgtId, srcIndex:srcIndex, tgtIndex:tgtIndex})


    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readwrite');
        let store = tx.objectStore('tabgroups');

        store.get(tgt.id).onsuccess = function(event1) {
            let tdata = event1.target.result;
            if (tgt.id == src.id) {
                tdata.tabs.splice(tgt.index + 1, 0, tdata.tabs[src.index]);
                tdata.tabs.splice(src.index + (src.index > tgt.index), 1);
                tdata.urls = tdata.tabs.map(t => t.url);

                store.put(tdata).onsuccess = moveNode;
                return;
            }
            // otherwise, cross group drag and drop
            store.get(src.id).onsuccess = function(event2) {
                let sdata = event2.target.result;
                let callback;

                if(src.group && tgt.group) {
                    tdata.tabs = tdata.tabs.concat(sdata.tabs);
                    sdata.tabs = []
                    callback = function() {
                        while(src.node.nextSibling) {
                            tgt.parentNode.appendChild(src.node.nextSibling);
                        }
                    }
                } else {
                    tdata.tabs.splice(tgt.index, 0, sdata.tabs[src.index]);
                    sdata.tabs.splice(src.index, 1);
                    callback = moveNode
                }

                tdata.urls = tdata.tabs.map(t => t.url);
                sdata.urls = sdata.tabs.map(t => t.url);

                let req = store.put(tdata)
                if(sdata.tabs.length > 0){
                    req.onsuccess = function(event) {
                        store.put(sdata).onsuccess = callback;
                    }
                }
                else {
                    req.onsuccess = function(event) {
                        store.delete(sdata.ts).onsuccess = function(event) {
                            let oldParent = src.parentNode;
                            callback();
                            oldParent.remove();
                        }
                    }
                }
            }

        }


    };
}
