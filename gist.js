//created by chatgpt
const url = "https://api.github.com/gists";
const filename = "odinochka.md";
const description = "Odinochka Saved Links";
const isPublic = false;  // Set to false if you want to create a private gist. Can always make public later.

async function createGist(filename, content, description, isPublic, token) {

    const data = {
        description: description,
        public: isPublic,
        files: {
            [filename]: {
                content: content
            }
        }
    };

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.html_url) {
            console.log("Gist created: " + data.html_url);
 			return data.html_url
        } else {
            console.error("Failed to create Gist", data);
        }
    })
    .catch(error => {
        console.error("Error:", error);
    });
}

export async function toGist(content) {
    
	console.log("Checking github host permission.");
	const {ghpat} = await chrome.storage.local.get("ghpat");
	if(!ghpat) {
		alert("No GH PAT")
		return;
	}

    console.log("Checking github host permission.");
    const granted = await chrome.permissions.request({origins:[url]});
	if(!granted) {
		console.error("No host permission!")
		return;
	}

	return createGist(filename, content, description, isPublic, ghpat);
}


