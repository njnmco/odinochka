
render()


function tabclick(event) {

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
                if(!cursor) return;

                var data = cursor.value;


                var ddiv = document.createElement("div");
                ddiv.id = data.ts;

                for(var tab of data.tabs) {
                    var a = document.createElement("a");
                    a.innerText = tab.title;
                    a.href = tab.url;
                    a.style = `--bg-favicon: url("${tab.favicon}")`;
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
