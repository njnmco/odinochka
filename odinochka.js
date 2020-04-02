
attachUrlListSycher()
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


function attachUrlListSycher() {
    let groups = document.getElementById("groups");

    let RSEP = "\036";

    let observer = new MutationObserver((ml, obs) => {
        let toUpdate = new Set();
        for(let mut of ml) {
            if(mut.target.id == "groups") {
                mut.addedNodes.forEach(x => toUpdate.add(x));
                mut.removedNodes.forEach(x => toUpdate.delete(x));
            } else if (mut.target.className == "group") {

                //console.log({mut:mut})
                let bf = mut.target.getAttribute("data-urls")
                mut.removedNodes.forEach(x =>
                        bf = bf.replace(RSEP + x.href + RSEP, RSEP)
                );
                mut.addedNodes.forEach(x =>
                        bf += RSEP + x.href + RSEP
                )
                mut.target.setAttribute("data-urls", bf)
                //console.log({bf:bf, mut:mut, af:af})
            }
        }
                //console.log(ml)


        for(let grp of toUpdate) {
            grp.setAttribute("data-urls",
                RSEP + Array.from(grp.getElementsByTagName("A")).map(x=>x.href).join(RSEP) + RSEP
            )
        }



    });



    observer.observe(groups, {childList: true, subtree:true});




}

function debounce(func, wait, immediate) {
    let timeout;
    return function(e) {
        const context = e,
                args = arguments;
        const later = () => {
                        timeout = null;
                        if (!immediate) func.apply(context, args);
                    };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

var filtertxt = "";
function cssfilter(x) {
    let node = document.getElementById("cssfilterstyle");
    if(x.target.value == "") {
        node.innerHTML = "";
        filtertxt = "";
        return;
    }
    let newfiltertxt = x.target.value;
    let css = node.sheet;

    var prefix = ""
    for(var i = css.cssRules.length - 1; i >=0; i--) {
        var rule = css.cssRules[i];
        var pref = /:not\(\[href\*="(.*)"]\)/.exec(rule.selectorText)[1]
        if(newfiltertxt.startsWith(pref)) {
            prefix = pref;
            break;
        }
        css.deleteRule(i); // have shortened query, delete
    }

    if(prefix == newfiltertxt) {
        filtertxt = newfiltertxt;
        return;
    }

    if(prefix == "") {
        //keepselector = `a.tab[href*="${newfiltertxt}"]`;
        selector  = `a.tab:not([href*="${newfiltertxt}"])`;
        selector2 = `div.group:not([data-urls*="${newfiltertxt}"])`;
    }
    else {
        keepselector = `a.tab[href*="${newfiltertxt}"]`;
        selector  = `a.tab[href*="${prefix}"]:not([href*="${newfiltertxt}"])`;
        selector2 = `div.group[data-urls*="${prefix}"]:not([data-urls*="${newfiltertxt}"])`;
    }

//    var hideGroups = new Set();
//    document.querySelectorAll(".group").forEach(
//        x => window.getComputedStyle(x).display == "block" &&
//             ! x.querySelector(keepselector) ? hideGroups.add(x.id) : null)
//
//    for(var hide of hideGroups) {
//        selector = selector + `, #\\3${hide.substring(0,1)} ${hide.substring(1,)}`
//    }

    css.insertRule(`${selector}, ${selector2} {display:none}`, css.cssRules.length);

    //node.innerHTML = `a.tab:not([href*="${x.target.value}"]) {display:none} `;
    // TODO someday when :has works, also hide the empty groups
    //
    filtertxt = newfiltertxt;
}

function doImport() {
    const selectedFile = document.forms['options'].elements['importfile'].files[0]

    let reader = new FileReader();
    
    reader.onload = function(event) {
        let tabs = JSON.parse(event.target.result);


        window.indexedDB.open("odinochka", 5).onsuccess = function(event){
            let db = event.target.result;

            let tx = db.transaction('tabgroups', 'readwrite');
            let store = tx.objectStore('tabgroups');
            let saveNext = function() {
                if(tabs.length) {
                    store.put(tabs.pop()).onsuccess = saveNext
                }
                else {
                    render()
                }
            }
            saveNext()
        }

    }
    reader.readAsText(selectedFile);


    return false;
}

function doExport() {
    let result = [];
    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readonly');
        let store = tx.objectStore('tabgroups');

        updateCount(store);

        store.openCursor(null, "prev").onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                result.push(cursor.value);
                cursor.continue();
            }
            else {
                // snippet by elite, https://stackoverflow.com/a/45831357
                let filename = "odinochka.json";
                let blob = new Blob([JSON.stringify(result)], {type: 'text/plain'});
                let e = document.createEvent('MouseEvents'),
                    a = document.createElement('a');
                a.download = filename;
                a.href = window.URL.createObjectURL(blob);
                a.dataset.downloadurl = ['text/plain', a.download, a.href].join(':');
                e.initEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                a.dispatchEvent(e);
            }
        };
    };
    return false;
}

function groupclick(event) {
    let me = event.target;
    let ts = parseInt(event.target.parentNode.id);
    let shiftclick = event.shiftKey
  
    if (event.clientX > me.offsetLeft + me.offsetWidth - 10) {
        chrome.tabs.create({url: 'data:text/html;charset=utf-8,' +
                                encodeURIComponent(
                                    '<html><style>a{display:block}</style>' +
                                    me.parentNode.innerHTML.replace(/draggable="true"|class="tab"|target="_blank"|style="[^"]*"/g, '') +
                                    '</html>'
                                )  })

        return false;
    }
  
    if( event.clientX > event.target.offsetLeft && !shiftclick) {
        // if inside box, make editable
        if(me.contentEditable == "false"){
              me.oldText = me.innerText;
              me.contentEditable = "true";
              me.focus();
        }
        return;
    }
  
    if(!shiftclick) { // if not shift, then was x
        if(!confirm("Delete this group?")) return;
    }
  
  
    // delete it
    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;
        let tx = db.transaction('tabgroups', 'readwrite');
        let store = tx.objectStore('tabgroups');
  
  
        if(!shiftclick) { // if not shift, then was x
            removeAndUpdateCount(store.delete(ts), me.parentNode)
            return;
        }
  
        store.get(ts).onsuccess = function(event) {
            var data = event.target.result;
  
            // smart selection
            var group = document.forms["options"].elements["group"].value;
            let restore = document.forms["options"].elements["restore"].value;
            let locked = data.name.indexOf("lock") > -1;

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
            if(!locked && restore != "keep") {
                removeAndUpdateCount(store.delete(ts), me.parentNode);
            }
  
        }
  
  
    }
    
    
}


function groupblur(event) {
    var me = event.target;
    var ts = parseInt(event.target.parentNode.id);
  
    var trimmer = function(s) {
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
            store.put(data).onsuccess = (e => renderHeader(data, me));
        }

    }
      
}

function removeAndUpdateCount(request, me) {
    request.onsuccess = function(event) {
        me.remove()
        updateCount(request.source)
    }
}

function deleteTabFromGroup(ts, i, node) {
    // Removes target from DB object
    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;
        let tx = db.transaction('tabgroups', 'readwrite');
        let store = tx.objectStore('tabgroups');

        if(i == 0 && node.nextSibling == null) {
            removeAndUpdateCount(store.delete(ts), node.parentNode)
        }
        else {
            store.get(ts).onsuccess = function(event) {
                let data = event.target.result;

                data.tabs.splice(i, 1);
                data.urls.splice(i, 1);

                removeAndUpdateCount(store.put(data), node);
            }
        }
    }
}

function tabclick(event) {

    let me = event.target;
    let ts = parseInt(me.parentNode.id);
    let isX = event.clientX < me.offsetLeft; // if outside box (eg x'd) don't follow link
    let restore = document.forms["options"].elements["restore"].value;
    let locked = me.parentNode.children[0].innerText.indexOf("lock") > 0;
    let i = Array.from(me.parentNode.children).indexOf(me) - 1;

    if (isX) {
        deleteTabFromGroup(ts, i, me);
        return false;
    }

    if (event.shiftKey || event.ctrlKey || locked || (restore  == "keep")) {
        return true;
    }

    chrome.tabs.create({url:me.href, pinned:me.target == "_pinned"}, t => deleteTabFromGroup(ts, i, me));
    return false;
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
        pinned: "skip",
        favicon: "show",
        order: 'asc',
        advanced: ""
    }

    chrome.storage.local.get(DEFAULT_OPTIONS, function(o) {
        for(let i in o) {
            if (i == 'advanced') {
                document.forms["options"].elements[i].value = o[i];
                continue;
            }
            document.forms["options"].elements[i].forEach(
                e => e.checked = e.value == o[i]
            )
        }
        document.getElementById('faviconstyle').media = o.favicon == 'hide' ? "not all" : 'all'; //set initial state
        document.getElementById('groups').style['flex-direction'] = o.order == 'asc' ? 'column-reverse' : 'column';
    })

    document.forms["options"].onchange = function (e) {
        let o = {};
        o[e.target.name] = e.target.value;
        chrome.storage.local.set(o);
    }


    document.getElementsByName("filter")[0].oninput = debounce(cssfilter, 50);

    for (e of document.getElementsByName("favicon")) {
        e.onchange = function(e) {document.getElementById('faviconstyle').media = this.value == 'hide' ? 'not all' : 'all'}
    }

    for (e of document.getElementsByName("order")) {
        e.onchange = function(e) {document.getElementById('groups').style['flex-direction'] = this.value == 'asc' ? 'column-reverse' : 'column'}
    }

    // Import / Export feature
    document.getElementsByName("importfile")[0].onchange = function() {
            this.setAttribute('value', this.value);
    };
    document.getElementsByName("import")[0].onclick = doImport;
    document.getElementsByName("export")[0].onclick = doExport;

}

function closeOthers() {
    chrome.tabs.getCurrent(current =>
        chrome.tabs.query(
          { url:"chrome-extension://*/odinochka.html" },
          tabs => chrome.tabs.remove(tabs.map(t => t.id).filter(t => t != current.id))
        )
    )
}

function fmtDate (ts) {
    let d = new Date();
    let thisYear = d.getYear()
    d.setTime(ts);
    return d.toLocaleString(
        undefined, //undefined uses browser default
        Object.assign(
            {weekday:'short', month: 'short', day: 'numeric',  hour:'numeric', minute:'numeric'},
            d.getYear() == thisYear ? {} : {year:"numeric"}
        )
    )
}


function renderHeader(data, header=null) {
    header = header || document.createElement("header");

    header.innerHTML = `${data.name} @ ${fmtDate(data.ts)}`;

    header.className = "tab";
    header.ondblclick = groupclick;
    header.onblur = groupblur;
    header.contentEditable = false;
    addDragDrop(header);
    return header;
}

function renderTab(tab, a = null) {
    a = a || document.createElement("a");
    a.innerText = tab.title;
    a.href = tab.url;
    if(tab.favicon){
        a.style = `--bg-favicon: url("${tab.favicon}")`;
    }
    a.className = "tab";
    a.onclick = tabclick;
    a.target = tab.pinned ? "_pinned" :  "_blank";
    addDragDrop(a);
    return a;
}

function renderGroup(data, ddiv=null) {
    ddiv = ddiv || document.createElement("div");
    ddiv.id = data.ts;
    ddiv.innerHTML = '';
    ddiv.className = 'group';

    ddiv.appendChild(renderHeader(data));

    for(let tab of data.tabs) {
        ddiv.appendChild(renderTab(tab));
    }
    return ddiv;
}

function render() {

    // Building tab list
    let groupdiv = document.getElementById("groups");
    groupdiv.innerHTML = '';

    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readonly');
        let store = tx.objectStore('tabgroups');

        updateCount(store);

        store.openCursor(null, "prev").onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                groupdiv.appendChild(renderGroup(cursor.value));
                cursor.continue();
            }
        };
    };

}

function update(data) {
    let groupdiv = document.getElementById("groups");
    let child = groupdiv.children.length ? groupdiv.children[0] : null;

    if(data.ts == groupdiv.children[0].id) {
        renderGroup(data, child)
    }
    else {
        groupdiv.insertBefore(renderGroup(data), child);
    }

    for(let i in data.update) {
       let node = document.getElementById(i);
       if (!node) continue;
       if (data.update[i] == 'd') {
           node.remove()
       }
       else {
           renderGroup(data.update[i], node);
       }
    }

    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;
        let tx = db.transaction('tabgroups', 'readonly');
        let store = tx.objectStore('tabgroups');

        updateCount(store);
    };
}

chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
          if(request.tabs) update(request);
          sendResponse();
          return true;
      })

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
