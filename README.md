# odinochka

## OneTab

I am a heavy OneTab user.

5k+ tabs.

Slow

GA tracking

Requests 900 favicons on boot via Google proxy
  * This also breaks locally hosted apps favicons

Not Great Suspender compatible
  - I've req'd this feature at least a few times over last 3 years.

## TODO
  - [x] Save Tabs
    - [x] Browser action button
    - [x] context menu
    - [x] Keyboard shortcuts
    - [x] Save tabs to indexeddb
    - [x] except pinned tabs
  - [x] UI page
    - [x] list tabs
        - [x] restore tab
        - [x] delete tab
        - [x] favicons
        - [x] drag and drop
          - [x] within tab group
          - [x] between tab group
          - [x] merge tab groups
    - [x] tab groups
      - [x] Restore
      - [x] Rename
      - [x] Delete
      - [x] pop out
    - [x] Counter
    - [x] Options
      - [x] skip pinned tabs
      - [x] Autoremove links
      - [x] How to open Groups
      - [x] Filter Duplicates
      - [x] Import / Export
      - [x] disable favicons
    - [x] Filter box
    - [x] refresh in place

## Etymology

Russian for singleton, but also:

  - Loner
  - Alaskan trading posts
  - solitary confinement

## Restoring from a crash

You can use the below `jq` command to convert from an [Export History extension](https://chrome.google.com/webstore/detail/export-historybookmarks-t/dcoegfodcnjofhjfbhegcgjgapeichlf)
dump format to a file that can be read back in to odinochka.

```
jq '[{ts:1, name:"restore", tabs:[.[] | {title:.title, url:.url, favicon:"", pinned:false}], urls:[.[].url]}]' history_export.json  >history2.json
```

Chrome can mysteriously delete data whenever it crashes, so I recommend regularly backing up your tabs using the export feature.
