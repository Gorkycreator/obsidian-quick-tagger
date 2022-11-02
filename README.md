# Obsidian Quick Tagger

This is a plugin for [Obsidian](https://obsidian.md) that adds commands and a GUI to select tags for the active note's frontmatter.

Originally developed to improve my personal workflow, it's mostly intended for use on mobile and in conjunction with [Obsidian Commander](https://github.com/phibr0/obsidian-commander). 

## Features
- No more typing in yaml headers just to add tags!
- Independant add/remove commands to minimize flicking through menus
- List your favorite tabs in the settings, those will show up at the top of the list

## Demo
![demo](images/quick_tagger_demo.gif)

Note that this demo was recorded with buttons added to the title bar via Obsidian Commander. Some assembly required. Ribbon icons and command pallet actions are available in the standalone plugin, but this is my preferred workflow on mobile.

## Disclaimer
This plugin is provided as-is, use at your own risk. I've tested it personally and use it on my vault but I can't confirm it's foolproof.

This plugin does not add the tags to an undo/redo queue, please be aware of that while you use it, particularly when removing all tags.

## Roadmap
- [ ] Add a confirmation warning for removing all tags

## Manually installing the plugin

- Copy over `main.js` and `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-quick-tagger/`.