import QuickTagPlugin, { QuickTaggerSettings } from "main";
import { selectTag, selectManyTags, wordWrap, getTagsFromFile, getActiveFile, addTagsDirectly, removeAllTagsDirectly } from "./utilities"
import { Menu, MenuItem, Notice, TFile } from "obsidian";
import { NonStashedTags, StashedTags } from "./tag_gatherers";
import { ACTIVE_STASH_TITLE } from "./constants";
import { STASH_INDICATOR } from "./constants";
import { clear } from "console";
import { onlyTaggableFiles } from "file_filters";
export { set_up_stashed_tags, populateStatusBarTagStashIndicator, add_tag_stash_options_to_tag_gatherer,
    modal_selection_is_a_stash, addCopyPasteMenuItems }


// region Setup
async function set_up_stashed_tags(plugin: QuickTagPlugin) {
    plugin.settings.tag_stash = new Array

    plugin.addCommand({
        id: 'stash-tag',
        name: 'Add tag to stash',
        callback: async () => {add_tag_to_stash(plugin)}
    });

    plugin.addCommand({
        id: 'stash-multiple-tags',
        name: 'Stash multiple tags',
        callback: () => {add_many_tags_to_stash(plugin)}
    })

    plugin.addCommand({
        id: 'unstash-tag',
        name: 'Remove tag from stash',
        callback: async () => {remove_tag_from_stash(plugin)}
    });

    plugin.addCommand({
        id: 'copy-tags-from-active',
        name: 'Copy tags on active note to stash',
        callback: async () => {copy_tags_on_active_to_stash(plugin)}
    })

    plugin.addCommand({
        id: 'copy-tags-to-active',
        name: 'Paste tags from stash on active note',
        callback: async () => {paste_tags_on_active_file(plugin)}
    })

    plugin.addCommand({
        id: 'replace-tags-on-active',
        name: 'Replace tags on active note with stashed tags',
        callback: async () => {
            let note = getActiveFile()
            removeAllTagsDirectly(plugin, note)
            paste_tags_on_active_file(plugin)
        }
    })

    plugin.addCommand({
        id: 'display-stash',
        name: 'Show current tag stash',
        callback: async () => {display_tag_stash(plugin)}
    })
}


async function addCopyPasteMenuItems(menu: Menu, files: TFile[], plugin: QuickTagPlugin){
    menu.addItem((item) =>{
        item
            .setTitle("Copy tags to stash")
            .setIcon("clipboard-copy")
            .onClick(async () => {
                let result = copy_tags_from_files_to_stash(plugin, files)
                if(!result){
                    new Notice(`No tags on selected files! Stash was not modified.`)
                }
            })
    })
    menu.addItem((item) =>{
        item
            .setTitle("Paste tags from stash")
            .setIcon("clipboard-paste")
            .onClick(async () => {
                paste_tags_on_file(plugin, files)
            })
    })
    menu.addItem((item) =>{
        item
            .setTitle("Replace tags with stash")
            .setIcon("clipboard-paste")
            .onClick(async () => {
                removeAllTagsDirectly(plugin, files)
                paste_tags_on_file(plugin, files)
            })
    })
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
        // TODO: complete saved stash feature
        // .addSeparator()
        // .addItem((item: MenuItem) =>{
        //     item.setTitle("Save stash")
        // })
    })
    menu.addSeparator()
}


// region modifying stash

async function add_tag_to_stash(plugin: QuickTagPlugin) {
    let tag = await selectTag(plugin, new NonStashedTags)
    plugin.app.vault.trigger('tag-stash-add', [tag])
}

async function add_many_tags_to_stash(plugin: QuickTagPlugin) {
    let tags = await selectManyTags(plugin, null, new NonStashedTags)
    plugin.app.vault.trigger('tag-stash-add', tags)
}

async function remove_tag_from_stash(plugin: QuickTagPlugin){
    let remove_tag = await selectTag(plugin, new StashedTags)
    plugin.app.vault.trigger('tag-stash-remove', remove_tag)
}


async function clear_stash(plugin: QuickTagPlugin){
    plugin.app.vault.trigger('tag-stash-remove', ['REMOVE ALL'])
}


// region copy/paste
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
        tags = [...new Set([...tags, ...new_tags])]
    }
    return _copy_tags_to_stash(plugin, tags)
    
}


async function _copy_tags_to_stash(plugin: QuickTagPlugin, tags: string[]){
    if(tags.length > 0){
        clear_stash(plugin)

        plugin.app.vault.trigger('tag-stash-add', tags)
        return true
    } else {
        return false
    }
}


async function paste_tags_on_file(plugin: QuickTagPlugin, files: TFile[]){
    let tags = plugin.settings.tag_stash
    addTagsDirectly(plugin, files, tags)
}


async function paste_tags_on_active_file(plugin: QuickTagPlugin){
    let file = getActiveFile()
    paste_tags_on_file(plugin, file)
}

// region save/load
async function save_stash(plugin: QuickTagPlugin){
    // TODO need a dialog to input stash name
}


// region modal/UI operations

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


/** takes a modal selection string and determines whether it represents a stash
 * 
 * @param str 
 * @returns 
 */
function modal_selection_is_a_stash(str: string){
    return str.contains(STASH_INDICATOR) || str.contains(ACTIVE_STASH_TITLE)
}

function display_tag_stash(plugin: QuickTagPlugin){
    let tag_stash = plugin.settings.tag_stash.join(", ")
    if (tag_stash){
        new Notice(tag_stash)
    } else {
        new Notice("Tag stash is empty!")
    }
}