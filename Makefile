.PHONY: tag

odinochka.zip : odinochka.html help.html odinochka.js manifest.json background.js images/*.png
	zip $@ $?

odinochka.zip : tag

tag : ##
	git tag -a `jq -r .version manifest.json`
