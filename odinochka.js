
render()
initOptions()


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

      var mydelete = function() {
            store.delete(ts).onsuccess = function(event) {
                me = me.parentNode;
                me.parentNode.removeChild(me)
                updateCount(store)
            }
      }

      if(shiftclick) {

        store.get(ts).onsuccess = function(event) {
            var data = event.target.result
            var restore = document.forms["options"].elements["restore"].value;

            chrome.windows.create({url: data.urls})

            // clean up
            if(restore != "keep") {
                chrome.tabs.getCurrent(t => chrome.tabs.remove(t.id));
                mydelete();
            }

        }

      } else {
          mydelete();
      }

  }
  
  
}

function groupblur(event) {
  var me = event.target;
  var ts = parseInt(event.target.parentNode.id);

  trimmer = function(s){
      var i = s.indexOf("@");
      if(i != -1) s = s.substr(0, i);
      return s.trim()
  }

  if(me.contentEditable == "true") {
      me.contentEditable = "false"
      console.log([me.innerText, me.oldText])

      var newtxt = trimmer(me.innerText);
      var oldtxt = trimmer(me.oldText);

      if(newtxt != oldtxt) {
      
        window.indexedDB.open("odinochka", 5).onsuccess = function(event){
            var db = event.target.result;

            var tx = db.transaction('tabgroups', 'readwrite');
            var store = tx.objectStore('tabgroups');

            store.get(ts).onsuccess = function(event) {
                    var data = event.target.result;
                    data.name = newtxt;
                    store.put(data).onsuccess = function(event) {
                        var prettyTime = new Date();
                        prettyTime.setTime(data.ts);
                        me.innerText = `${data.name} @ ${prettyTime.toUTCString()}`;
                    }
            }

        }
      
      
      
      
      
      }

  }

}

function tabclick(event) {

        var me = event.target;
        var ts = parseInt(event.target.parentNode.id);
        var url = event.target.href;
        var isX = event.clientX < event.target.offsetLeft; // if outside box (eg x'd) don't follow link
        var restore = document.forms["options"].elements["restore"].value;


        if(isX || !(event.shiftKey || event.ctrlKey || (restore  == "keep"))){
            console.log({isX:isX, event:event, restore:restore});
            // Removes target from DB object
            window.indexedDB.open("odinochka", 5).onsuccess = function(event){
                var db = event.target.result;

                var tx = db.transaction('tabgroups', 'readwrite');
                var store = tx.objectStore('tabgroups');

                store.get(ts).onsuccess = function(event) {
                    var data = event.target.result;

                    if(data.urls.length == 1) {
                        store.delete(ts).onsuccess = function(event){
                            me = me.parentNode;
                            me.parentNode.removeChild(me);
                            updateCount(store);
                        }

                        return null;
                    }

                    var i = data.urls.indexOf(url);

                    data.tabs.splice(i, 1)
                    data.urls = data.tabs.map(a => a.url);

                    store.put(data).onsuccess = function(event){
                        me.parentNode.removeChild(me)
                        updateCount(store);
                    }
                }
            }
        }//shift/ctrl if


    return !isX; //only open if not X

}

function updateCount(store) {
        store.index("urls").count().onsuccess=function(e){
            document.getElementById("size").innerText = e.target.result + " tabs"
        }
}


function initOptions() {
    var DEFAULT_OPTIONS = {
        dupe: "keep",
        restore: "remove",
        pinned: "skip"
    }

    chrome.storage.local.get(DEFAULT_OPTIONS, function(o) {
        for(i in o) document.forms["options"].elements[i].forEach(
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
        for(i in changes) document.forms["options"].elements[i].forEach(
            e => e.checked = e.value == changes[i].newValue
        )
    })

}

function render() {


    // Building tab list

    var groupdiv = document.getElementById("groups");


    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');

        updateCount(store);

        store.openCursor(null, "prev").onsuccess = function(event) {
                var cursor = event.target.result;
                var ddiv = document.createElement("div");
                if(!cursor){
                    //groupdiv.appendChild(ddiv); // forces floats to clear
                    return;
                }

                var data = cursor.value;


                ddiv.id = data.ts;

                var prettyTime = new Date();
                prettyTime.setTime(data.ts);


                var header = document.createElement("header");
                header.innerText = `${data.name} @ ${prettyTime.toUTCString()}`;
                header.className = "tab";
                header.ondblclick = groupclick;
                header.onblur = groupblur;
                header.contentEditable = false;
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
                    a.target = "_blank";

                    ddiv.appendChild(a);
                }


                var footer = document.createElement("footer");
                ddiv.appendChild(footer);
                
                groupdiv.appendChild(ddiv);
                cursor.continue();

        };
    };

}
