# Obsidian Quick Tagger

This is a plugin for [Obsidian](https://obsidian.md) that adds commands and a GUI to select tags for the active note's frontmatter.

Originally developed to improve my personal workflow, it's mostly intended for use on mobile and in conjunction with [Obsidian Commander](https://github.com/phibr0/obsidian-commander). 

## Features
- No more typing in yaml headers just to add tags!
- Independent add/remove commands to minimize flicking through menus
- List your favorite tags in the settings, those will show up at the top of the list

## Demo
![demo](images/quick_tagger_demo.gif)

Note that this demo was recorded with buttons added to the title bar via Obsidian Commander. Some assembly required. Ribbon icons and command pallet actions are available in the standalone plugin, but this is my preferred workflow on mobile.

## Disclaimer
This plugin is provided as-is, use at your own risk. I've tested it personally and use it on my vault but I can't confirm it's foolproof in every situation.

This plugin does not keep track of changes in an undo/redo queue, please be aware of that while you use it, particularly when removing all tags.

## Roadmap
- [x] Add a confirmation warning for removing all tags
- [ ] Permit adding new tag from tag selector

## Manually install the plugin

Copy `main.js` and `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-quick-tagger/`.