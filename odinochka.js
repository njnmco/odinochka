
render()


function groupclick(event) {
  var me = event.target;
  var ts = parseInt(event.target.parentNode.id);

  if( event.clientX > event.target.offsetLeft) {
      // if inside box, make editable
      if(me.contentEditable == "false"){
            me.oldText = me.innerText;
            me.contentEditable = "true";
            me.focus();
      }
  } else {
        // delete it
        window.indexedDB.open("odinochka", 5).onsuccess = function(event){
            var db = event.target.result;

            var tx = db.transaction('tabgroups', 'readwrite');
            var store = tx.objectStore('tabgroups');

            store.delete(ts).onsuccess = function(event) {
                me = me.parentNode;
                me.parentNode.removeChild(me)
            }

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

    {
        var me = event.target;
        var ts = parseInt(event.target.parentNode.id);
        var url = event.target.href;


        if(!(event.shiftKey || event.ctrlKey)){
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
                        }

                        return null;
                    }

                    var i = data.urls.indexOf(url);

                    data.tabs.splice(i, 1)
                    data.urls = data.tabs.map(a => a.url);

                    store.put(data).onsuccess = function(event){
                        me.parentNode.removeChild(me)
                    }
                }
            }
        }//shift/ctrl if

    }

    return event.clientX > event.target.offsetLeft; // if outside box (eg x'd) don't follow link

}

function render() {
    var groupdiv = document.getElementById("groups");


    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');
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
