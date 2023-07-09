# Obsidian Quick Tagger

This is a plugin for [Obsidian](https://obsidian.md) that adds commands and a GUI to select tags to put in note metadata.

Originally developed to improve my personal workflow, it's very handy in conjunction with [Obsidian Commander](https://github.com/phibr0/obsidian-commander).

## Features
- No more typing in yaml headers just to add tags!
- Independent add/remove commands to minimize flicking through menus
- Right click on file(s) to add tags
- Tag all search results
- Starred Tags

## Demo
![demo](images/quick_tagger_demo.gif)

Note that this demo was recorded on mobile with buttons added to the title bar via Obsidian Commander. Some assembly required. Ribbon icons and command pallet actions are available in the standalone plugin, but this is my preferred workflow.

### Menu options
![file-menu](images/file-right-click-menu.png)

![search-menu](images/search-results-menu.png)


### Starred Tags
Starred tags have the following features, each independently configurable:
  - Add tag to top of the list when selecting a tag
  - Add right-click context entry
  - Add Obsidian command to toggle the tag on the current note (use this to make hotkeys!)
  - Add status bar button to toggle the command on the current note

![starred-tag-demo](images/starred-tag-demo.gif)

## Disclaimer
This plugin is provided as-is, use at your own risk. I've tested it personally and use it on my vault but I can't confirm it's foolproof in every situation.

This plugin does not keep track of changes in an undo/redo queue, please be aware of that while you use it, particularly when bulk tagging or removing all tags.

## Roadmap
- [x] Add a confirmation warning for removing all tags
- [x] Improved settings menu
- [x] Starred tags (improved priority tags)
- [x] Add command for starred tag
- [x] Add button for starred tag in status bar
- [x] Add right-click context menu option for starred tag
- [ ] Repeat last tag command
- [ ] Tag chains (cycle through a list of tags)
- [ ] Permit adding new tag from tag selector

## Manually install the plugin

Copy `main.js` and `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-quick-tagger/`.


## Special thanks to...
- [Supercharged links](https://github.com/mdelobelle/obsidian_supercharged_links) and [Obsidian Variables](https://github.com/jffaust/obsidian-variables) for examples of adding and removing setting elements.
- [QuickAdd](https://github.com/chhoumann/quickadd) for examples of how to add and remove commands.
- [Toggl Track](https://github.com/mcndt/obsidian-toggl-integration) and [Spaced Repetition](https://github.com/st3v3nmw/obsidian-spaced-repetition) for examples of working with status bar elements.