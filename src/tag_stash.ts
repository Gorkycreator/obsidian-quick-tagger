import QuickTagPlugin, { QuickTaggerSettings } from "main";
import { selectTag, selectManyTags, wordWrap, getTagsFromFile, getActiveFile, addTagsDirectly } from "./utilities"
import { Menu, MenuItem, Notice, TFile } from "obsidian";
import { NonStashedTags, StashedTags } from "./tag_gatherers";
import { ACTIVE_STASH_TITLE } from "./constants";
import { STASH_INDICATOR } from "./constants";
import { clear } from "console";
import { onlyTaggableFiles } from "file_filters";
export { set_up_stashed_tags, populateStatusBarTagStashIndicator, add_tag_stash_options_to_tag_gatherer,
    modal_selection_is_a_stash, addCopyPasteMenuItems }

async function set_up_stashed_tags(plugin: QuickTagPlugin) {
    plugin.settings.tag_stash = new Array

    plugin.addCommand({
        id: 'stash-tag',
        name: 'Stash tag',
        callback: async () => {add_tag_to_stash(plugin)}
    });

    plugin.addCommand({
        id: 'stash-multiple-tags',
        name: 'Stash multiple tags',
        callback: () => {add_many_tags_to_stash(plugin)}
    })

    plugin.addCommand({
        id: 'unstash-tag',
        name: 'Unstash tag',
        callback: async () => {remove_tag_from_stash(plugin)}
    });

    plugin.addCommand({
        id: 'copy-tags-from-active',
        name: 'Copy tags on active to stash',
        callback: async () => {copy_tags_on_active_to_stash(plugin)}
    })

    // TODO: add file-menu to copy tags from note

    // TODO: add command to paste tags on current note

    // TODO: add file-menu to paste tags on note
}


async function addCopyPasteMenuItems(menu: Menu, files: TFile[], plugin: QuickTagPlugin){
    menu.addItem((item) =>{
        item
            .setTitle("Copy tags to stash")
            .setIcon("clipboard-copy")
            .onClick(async () => {
                console.log(files)  // TODO: remove debugging
                let result = copy_tags_from_files_to_stash(plugin, files)
                if(!result){
                    new Notice(`No tags on selected files! Stash was not modified.`)
                }
            })
    })
}


async function add_tag_to_stash(plugin: QuickTagPlugin) {
    let tag = await selectTag(plugin, new NonStashedTags)
    plugin.settings.tag_stash.push(tag)
    plugin.settings.tag_stash.sort()
    await plugin.saveSettings()
}

async function add_many_tags_to_stash(plugin: QuickTagPlugin) {
    let tags = await selectManyTags(plugin, null, new NonStashedTags)
    tags.forEach((tag) => {
        plugin.settings.tag_stash.push(tag)
    })
    plugin.settings.tag_stash.sort()
    await plugin.saveSettings()
}


async function remove_tag_from_stash(plugin: QuickTagPlugin){
    let remove_tag = await selectTag(plugin, new StashedTags)
    if (remove_tag == "REMOVE ALL"){
        console.log("removing all tags from stash.....")
        plugin.settings.tag_stash = new Array
    } else {
        let tag_array = plugin.settings.tag_stash.filter((tag) => {return tag != remove_tag})
        plugin.settings.tag_stash = tag_array
    }
    await plugin.saveSettings()
}


async function clear_stash(plugin: QuickTagPlugin){
    plugin.settings.tag_stash = new Array
    await plugin.saveSettings()
}


async function copy_tags_on_active_to_stash(plugin: QuickTagPlugin){
    let file = getActiveFile()
    let result = copy_tags_from_files_to_stash(plugin, file)
    if(!result){
        new Notice(`No tags on ${file}! Stash was not modified.`)
    }
}

async function copy_tags_from_files_to_stash(plugin: QuickTagPlugin, files: TFile[]){
    let tags: string[] = []
    for(let i=0;i < files.length; i++){
        let new_tags = getTagsFromFile(plugin, files[i])
        console.log(`tags_mid_loop: ${new_tags}`)  // TODO: remove debugging
        tags = [...new Set([...tags, ...new_tags])]
    }
    console.log(`stashing tags... ${tags}`)  // TODO: remove debugging
    return copy_tags_to_stash(plugin, tags)
    
}

async function copy_tags_to_stash(plugin: QuickTagPlugin, tags: string[]){
    if(tags.length > 0){
        clear_stash(plugin)

        tags.forEach((tag) => {
            plugin.settings.tag_stash.push(tag)
        })
        plugin.settings.tag_stash.sort()
        await plugin.saveSettings()
        return true
    } else {
        return false
    }
}


async function paste_tags_on_note(plugin: QuickTagPlugin, file: TFile[]){
    let tags = plugin.settings.tag_stash
    addTagsDirectly(plugin, file, tags)
}


async function save_stash(plugin: QuickTagPlugin){
    // TODO need a dialog to input stash name
}


async function populateStatusBarTagStashIndicator(menu: Menu, plugin: QuickTagPlugin){
	menu.addItem((item) => {

		// TODO: this needs to actually find the stashed tags, not the starred tags (that was used for testing)
		let stashed_text = "Stashed tags:\n" + plugin.settings.tag_stash.join(", ")
		stashed_text = wordWrap(stashed_text, 25, "\n ")
		item.setTitle(stashed_text).setIsLabel(true)
	})
    menu.addItem((item) => {
        let subMenu = item.setTitle("Edit stash")
        .setSubmenu()

        subMenu
        .addItem((item: MenuItem) => {
            item.setTitle("Add tag")
            .onClick(async () => {add_tag_to_stash(plugin)})
        })
        .addItem((item: MenuItem) =>{
            item.setTitle("Add multiple")
            .onClick(async () => {add_many_tags_to_stash(plugin)})
        })
        .addItem((item: MenuItem) => {
            item.setTitle("Remove tag")
            .onClick(async () => {remove_tag_from_stash(plugin)})
        })
        .addItem((item: MenuItem) => {
            item.setTitle("Clear stash")
            .onClick(async () => {clear_stash(plugin)})
        })
        .addSeparator()
        .addItem((item: MenuItem) =>{
            item.setTitle("Save stash")
            // TODO: add callback function
        })
    })
    menu.addSeparator()
}


/** Used within a tag gatherer to add active and saved stashes to the end of the item list
 * 
 * @param tag_list 
 * @param settings 
 */
function add_tag_stash_options_to_tag_gatherer(tag_list: string[], settings: QuickTaggerSettings){
    if (settings.tag_stash.length > 0){
        tag_list.push(prep_tag_stash_entry(settings.tag_stash, ACTIVE_STASH_TITLE, ": "))
    }
    settings.saved_stashes.forEach((stash) =>{
        tag_list.push(prep_tag_stash_entry(stash.tags, stash.name, STASH_INDICATOR))
    })
}


/** takes a tag array and converts it for display in a selection modal
 * 
 * @param tags 
 * @param name the name of the tag stash
 * @param name_suffix what should be appended to separate the name from the tags
 * @returns 
 */
function prep_tag_stash_entry(tags: string[], name: string, name_suffix: string){
    return name + name_suffix + tags.join(", ")
}


/** Takes a modal selection string and parses it back into a tag array
 * 
 * @param user_choice string returned from a Modal selection
 */
function parse_tag_stash_entry(user_choice: string): string[]{
    // TODO: get the tag stash and return array. This will likely require wide sweeping changes
    //       to make all tag applications work on arrays, not individual strings 
    return []
}


/** takes a modal selection string and determines whether it represents a stash
 * 
 * @param str 
 * @returns 
 */
function modal_selection_is_a_stash(str: string){
    return str.contains(STASH_INDICATOR) || str.contains(ACTIVE_STASH_TITLE)
}