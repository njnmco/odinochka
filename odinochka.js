import {do_gdrive_backup} from './gdrive.js'

// defer render til loaded, h/t snte
document.addEventListener('DOMContentLoaded', function () {
    render()
    initOptions()
    closeOthers()
});



function newWindow(data) {
  chrome.windows.create({url: data.urls}, function(w) {
      w.tabs.filter((t,i) => data.tabs[i].pinned).forEach(
        t => chrome.tabs.update(t.id, {pinned: true})
      )
  })
}

async function newTabs(data) {
    let tabIds = []

    for(let o of data.tabs) {
        let tab = chrome.tabs.create({url: o.url, pinned: o.pinned, active: false});
        tabIds.push(tab.then(t => t.id));
    }

    tabIds = await Promise.all(tabIds);
    chrome.tabs.update(tabIds[tabIds.length - 1], {active:true});
    return tabIds;
}

async function newGroup(data) {
    let tabIds = await newTabs(data);
    let groupID = await chrome.tabs.group({tabIds:tabIds});
    chrome.tabGroups.update(groupID, {title:data.name});
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

function cssfilter(x) {
    let node = document.getElementById("cssfilterstyle");
    let newfiltertxt = x.target.value;
    if(newfiltertxt == "") {
        node.innerHTML = "";
    }
    else {
        selector  = `a.tab:not([href*="${newfiltertxt}"])`;
        selector2 = `div.group:not(:has(a.tab[href*="${newfiltertxt}"]))`;
        node.innerHTML= `
          ${selector}, ${selector2} {display:none}
          span#clearFilter {display:inline}
        `
    }
}

function doClearFilter() {
    document.getElementById("filter").value = '';
    cssfilter({target: document.getElementById("filter")});
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

function download(result) {
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

function doExport(process_result=download) {
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
				process_result(result)
            }
        };
    };
    return false;
}


function doExportGdrive() {
    doExport(do_gdrive_backup)
    return false;
}

function groupclick(event) {
    let me = event.target;
    let ts = parseInt(event.target.parentNode.id);
    let shiftclick = event.shiftKey

    if (event.clientX > me.offsetLeft + me.offsetWidth - 10) {
        var code = me.parentNode.innerHTML.replace(/draggable="true"|class="tab"|target="_blank"|style="[^"]*"/g, '')

        chrome.tabs.create({url: 'data:text/html;charset=utf-8,' +
                                encodeURIComponent(
                                    '<html><head><style>a{display:block}</style>' +
                                    `<style>${document.getElementById("cssfilterstyle").innerHTML.replace(/.tab/, "")}</style>` +
                                    `<title>${me.textContent}</title>` + code +
                                    '</html>'
                                )  })

        return false;
    }

    if( event.clientX > event.target.offsetLeft && !shiftclick) {
        // if inside box, make editable
        if(me.contentEditable == "false"){
              me.oldText = me.textContent;
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



        store.get(ts).onsuccess = function(event) {
            var data = event.target.result;

            // TODO merge with similar chunk in drop() into helper
            // find out which tabs are actuall displayed
            let snode = me.nextSibling;
            let i = 0, toShow = [], toKeep = [], toRemoveNodes = [];
            while(snode) {
                if(window.getComputedStyle(snode).display == 'none') {
                    toKeep.push(data.tabs[i]);
                } else {
                    toShow.push(data.tabs[i]);
                    toRemoveNodes.push(snode);
                }
                snode = snode.nextSibling; i++;
            }



            // smart selection
            var group = document.forms["options"].elements["group"].value;
            let restore = document.forms["options"].elements["restore"].value;
            let locked = data.name.indexOf("lock") > -1;

            data.tabs = toShow;

            if(!shiftclick) {
                // if not shift, then was x
            }
            else if(group == 'new') {
                newWindow(data);
            }
            else if(group == 'current') {
                newTabs(data);
            }
            else if(group == 'tabGroup') {
                newGroup(data);
            }
            else if(group == 'smart') {
               
                chrome.tabs.query(
                    {currentWindow:true, active:false, pinned: false, groupId:chrome.tabGroups.TAB_GROUP_ID_NONE},
                    w => w.length >= 1 ? newWindow(data) : newGroup(data)
                )
                
            }


            // clean up
            if(!locked && restore != "keep") {
                if(toKeep.length == 0) {
                    removeAndUpdateCount(store.delete(ts), me.parentNode);
                } else {
                    // make a new object here, race condition with window creation
                    // if you do data.tabs = toKeep, the wrong tabs can be shown stochasticly.
                    let data2 = {
                        ts: data.ts,
                        name: data.name,
                        tabs: toKeep,
                        urls: toKeep.map(t => t.url)
                    };

                    request = store.put(data2);
                    //todo generalize removeAndUpdateCount to be variadic to handle below.
                    request.onsuccess = function(event) {
                        for(let n of toRemoveNodes) {
                            n.remove();
                        }
                        updateCount(request.source)
                        cssfilter({target: document.getElementById("filter")});
                    }
                }
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

    var newtxt = trimmer(me.textContent);
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
    let locked = me.parentNode.children[0].textContent.indexOf("lock") > 0;
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
        document.getElementById("size").textContent = e.target.result + " tabs";
    }
}


function initOptions() {
    let DEFAULT_OPTIONS = {
        dupe: "keep",
        restore: "remove",
        group: "smart",
        pinned: "skip",
        audible: "close",
        favicon: "show",
        order: "desc",
        grabfocus: "always",
    }

    chrome.storage.local.get(DEFAULT_OPTIONS, function(o) {
        for(let i in o) {
            document.forms["options"].elements[i].forEach(
                e => e.checked = e.value == o[i]
            )
        }
        if (o.favicon == "show") document.getElementById('faviconstyle').media = 'all'; //set initial state
        if (o.order == "asc") document.getElementById('orderstyle').media = 'all'; //set initial state
    })

    document.forms["options"].onchange = function (e) {
        let o = {};
        o[e.target.name] = e.target.value;
        chrome.storage.local.set(o);
    }


    document.getElementById("filter").oninput = debounce(cssfilter, 50);
    document.getElementById("clearFilter").onclick = doClearFilter;

    const handle_sty = function(e){ document.getElementById(this.name + 'style').media = this.dataset.media};
    document.querySelectorAll("[name=favicon], [name=order]").forEach(e => e.onchange = handle_sty);

    // Import / Export feature
    document.getElementById("importfile").onchange = function() {
            this.setAttribute('value', this.value);
    };
    document.getElementById("import").onclick = doImport;
    document.getElementById("export").onclick = doExport;
    document.getElementById("gdrive").onclick = doExportGdrive;

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
    let fmt = {weekday:'short', month: 'short', day: 'numeric',  hour:'numeric', minute:'numeric'};
    let d = new Date();
    let thisYear = d.getYear()
    d.setTime(ts);
    if(d.getYear() != thisYear) fmt.year="numeric";
    return d.toLocaleString( undefined, fmt) //undefined uses browser default
}

document.addEventListener("dragover", function(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
});
document.addEventListener("dragenter", function(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
});

function divclickhandler(event) {
    var target = event.target;
    if (!target || target.className != 'tab')
        return true;

    switch(event.type) {
        case 'click':
            return target.tagName != 'A' || tabclick(event);
        case 'dblclick':
            return target.tagName != 'HEADER' || groupclick(event);
        case 'blur':
            return target.tagName != 'HEADER' || groupblur(event);
        case 'dragstart':
            target.id = 'drag'
            event.dataTransfer.setData("text/plain", "foo");
            // NB data is not set by default on HEADER tags :/
            event.dataTransfer.effectAllowed = "move";
            return true;
        case 'dragend':
            target.id = ''
            return true;
        case 'drop':
            return drop(event);
    }

    console.warn(event); // should be impossible
    return true;
}

function renderHeader(data, header=null) {
    header = header || document.createElement("header");

    header.textContent = `${data.name} @ ${fmtDate(data.ts)}`;

    header.className = "tab";
    header.contentEditable = false;
    header.draggable = true;
    header.setAttribute('tabindex', '0');
    return header;
}

function renderTab(tab,  a = null) {
    a = a || document.createElement("a");
    a.textContent = tab.title;
    a.href = tab.url;
    let favicon = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=32`
    a.style.setProperty('--bg-favicon', `url("${favicon}")`);
    a.className = "tab";
    a.target = tab.pinned ? "_pinned" :  "_blank";
    a.draggable = true;
    return a;
}

function renderGroup(data, ddiv=null) {
    ddiv = ddiv || document.createElement("div");
    ddiv.id = data.ts;
    ddiv.innerHTML = '';
    ddiv.className = 'group';

    ddiv.append(renderHeader(data), ... data.tabs.map(x => renderTab(x)));

    return ddiv;
}

function render() {

    // Building tab list
    let groupdiv = document.getElementById("groups");
    groupdiv.innerHTML = '';
    // NB https://stackoverflow.com/a/5423029/986793 must use 'onclick' etc to cancel events via return value
    for(var ev of ['click', 'dblclick', 'dragstart', 'dragend','drop'])
        groupdiv['on'+ev]= divclickhandler
    groupdiv.addEventListener('blur', divclickhandler, true); // onblur won't trigger, but can capture?

    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readonly');
        let store = tx.objectStore('tabgroups');

        updateCount(store);

        store.openCursor(null, "prev").onsuccess = function(event) {
            let cursor = event.target.result;
            if (cursor) {
                cursor.continue();

                let data = cursor.value;
                // TODO
                // if(data.name.startswith('snooze')) {
                //     if(check_time) {
                //         let prom = newGroup(data);
                //         prom.then( cursor.delete );
                //         return;
                //     }
                // }


                groupdiv.appendChild(renderGroup(data));
            }
        };
    };

}

function update(data) {
    let groupdiv = document.getElementById("groups");
    let child = groupdiv.children.length ? groupdiv.children[0] : null;

    if(child && data.ts == child.id) {
        groupdiv.replaceChild(renderGroup(data), child);
    }
    else {
        // if child is null, then append
        groupdiv.insertBefore(renderGroup(data), child);
    }

    for(let i in data.update) {
       let node = document.getElementById(i);
       if (!node) continue;
       if (data.update[i] == 'd') {
           node.remove()
       }
       else {
           groupdiv.replaceChild(renderGroup(data.update[i]), node);
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
        cssfilter({target: document.getElementById("filter")});
    }

    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        let db = event.target.result;

        let tx = db.transaction('tabgroups', 'readwrite');
        let store = tx.objectStore('tabgroups');

        store.get(tgt.id).onsuccess = function(event1) {
            let tdata = event1.target.result;

            // link-to-link within a group
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

                // group to group
                if(src.group && tgt.group) {
                    let toAppendNodes = [], toKeepTabs = [];
                    let snode = src.node.nextSibling, i = 0;
                    while(snode) {
                        if(window.getComputedStyle(snode).display == 'none') {
                            toKeepTabs.push(sdata.tabs[i])
                        } else {
                            toAppendNodes.push(snode);
                            tdata.tabs.push(sdata.tabs[i])
                        }
                        snode = snode.nextSibling;
                        i++;
                    }
                    sdata.tabs = toKeepTabs;
                    callback = function() {
                        tgt.parentNode.append(...toAppendNodes);
                        if(sdata.tabs.length > 0) {
                            cssfilter({target: document.getElementById("filter")});
                        }
                    }
                } else {
                    // link to group
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
