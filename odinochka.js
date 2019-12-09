
render()


function tabclick(event) {

    console.log(event)
    {
        var me = event.target;
        var ts = parseInt(event.target.parentNode.id);
        var url = event.target.href;


        if(!(event.shiftKey || event.ctrlKey)){
            window.indexedDB.open("odinochka", 5).onsuccess = function(event){
                var db = event.target.result;

                var tx = db.transaction('tabgroups', 'readwrite');
                var store = tx.objectStore('tabgroups');

                store.get(ts).onsuccess = function(event) {
                    var data = event.target.result;



                    var i = data.urls.indexOf(url);

                    data.tabs.splice(i, 1)
                    data.urls = data.tabs.map(a => a.url);

                    store.put(data)


                    me.parentNode.removeChild(me)
                    console.log(event)
                }
            }
        }//shift/ctrl if

    }

    return event.clientX > event.target.offsetLeft;

}

function render() {
    var groupdiv = document.getElementById("groups");


    window.indexedDB.open("odinochka", 5).onsuccess = function(event){
        var db = event.target.result;

        var tx = db.transaction('tabgroups', 'readwrite');
        var store = tx.objectStore('tabgroups');
        store.openCursor().onsuccess = function(event) {
                var cursor = event.target.result;
                var ddiv = document.createElement("div");
                if(!cursor){
                    groupdiv.appendChild(ddiv); // forces floats to clear
                    return;
                }

                var data = cursor.value;


                ddiv.id = data.ts;

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

                groupdiv.appendChild(ddiv);
                
                cursor.continue();

        };
    };

}
