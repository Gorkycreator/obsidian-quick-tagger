import{ Notice, App, TFile, Menu, Component, MenuItem } from 'obsidian'
import QuickTagPlugin, { QuickTaggerSettings, StarredTag } from "./main"
import { ConfirmModal, QuickTagSelector, QuickTagSelectorLoop } from './modal'
import { AddTagList, TagGatherer, TagsOnFiles } from './tag_gatherers'
import { filterTags, getFilteredWithTags, getFilteredWithoutTags } from './file_filters'
import { SPECIAL_COMMANDS, TAG_KEY, WOAH_LOTS_OF_FILES, TAG_CLEANUP_KEYS } from './constants'
import { is_modal_selection_a_stash, populateStatusBarTagStashIndicator } from "./tag_stash"
export { selectTag, addTagsWithModal, addTagWithModal, removeTagWithModal, removeTagsWithModal,
	toggleTagOnActive, toggleTagOnFile, dynamicToggleCommand, dynamicAddMenuItems, constructTaggerContextMenu,
    wordWrap, selectManyTags, modal_selection_is_special }
export { _formatHashTag, _addFrontMatterTags, _cleanNoteContent, _getRemovalProcessor, 
	_removeAllFrontMatterTags, _removeFrontMatterTag, _conformToArray, showStatusBarMenu }


/** Gets the active file
 * 
 * @returns Tfile array
 */
function _getActiveFile() {
	let thisFile = this.app.workspace.getActiveFile()
	if(thisFile instanceof TFile) {
		return [thisFile]
	} else {
		new Notice("No file open!")
		return [] as TFile[]
	}
}


/** Add a tag to a note
 * 
 * @param thisFile the file to edit
 * @param tag the tag to add
 */
async function _addTags(thisFile: TFile, tags: string[]){
	console.log("hello") // TODO: remove debug
	this.tags = tags.map((tag) => _formatHashTag(tag))
	await _cleanFile(thisFile)
	await this.app.fileManager.processFrontMatter(thisFile, _addFrontMatterTags.bind(this))
}


/** Add tag to a note; extracted from Obsidian functionality
 * 
 * @param frontmatter an object with a tags key
 */
function _addFrontMatterTags(frontmatter: {tags: string[]}){
	console.log("FRONTMATTER") // TODO: remove debug
	frontmatter = _collectExistingTags(frontmatter);
	frontmatter[TAG_KEY] = frontmatter[TAG_KEY].map((t:string) => _formatHashTag(t))

	// https://www.peterbe.com/plog/merge-two-arrays-without-duplicates-in-javascript
	let merged = [...new Set([...frontmatter[TAG_KEY], ...this.tags])]
	console.log(merged)

	frontmatter[TAG_KEY] = merged
}


/** Remove a tag from a note
 * 
 * @param tag the tag to remove
 */
async function _removeTags(thisFile: TFile, tags: string[]){
	this.tags = tags.map((tag) => _formatHashTag(tag))
	await _cleanFile(thisFile)
	let processor = _getRemovalProcessor(tags)
	await this.app.fileManager.processFrontMatter(thisFile, processor.bind(this))
}

/** Select the function to be used with tag removal
 * 
 * @param tag 
 * @returns 
 */
function _getRemovalProcessor(tags: string[]){
	if (tags[0] != "REMOVE ALL"){
		return _removeFrontMatterTag
	} else {
		console.log("removing all tags.....")
		return _removeAllFrontMatterTags
	}
}


/** Remove a single tag from a note; separated from Obsidian logic
 * 
 * @param frontmatter 
 */
function _removeFrontMatterTag(frontmatter: {tags: string[]}) {
	frontmatter = _collectExistingTags(frontmatter)
	let tags = frontmatter[TAG_KEY]
	tags = tags.map((t:string) => _formatHashTag(t))
	frontmatter[TAG_KEY] = tags.filter((t) => {return !this.tags.contains(t)})
}


/** Remove all tags from a note; separated from Obsidian logic
 * 
 */
function _removeAllFrontMatterTags(frontmatter: {tags: string[]}) {
	frontmatter[TAG_KEY] = []
}


/** Add or remove the given tag on the given files
 * 
 * @param files 
 * @param tag 
 * @returns number added, number removed 
 */
function _toggleTags(files: TFile[], input_tag: string): number[] {
	let tag = _formatHashTag(input_tag)
	let tag_added = 0
	let tag_removed = 0

	for(let i=0; i<files.length; i++){
		let exists = filterTags(files[i], [`#${tag}`])
		if(!exists){
			_addTags(files[i], [tag])
			tag_added++
		} else {
			_removeTags(files[i], [tag])
			tag_removed++
		}
	}
	return [tag_added, tag_removed]
}


/** Loop over files and add tags
 * 
 * 
 * @param files array of files to edit
 * @param tag tag to add
 * @param plugin a reference to the plugin (used to update status bar)
 */
async function _addTagsToMany(files:TFile[], tags:string[], plugin: QuickTagPlugin){
	console.log("ADDING TAGS")
	await _apply_bulk_changes(files, tags, plugin, _addTags)
}


/** Loop over files and remove tags
 * 
 * @param files array of files to edit
 * @param tag tag to remove
 * @param plugin a reference to the plugin (used to update status bar)
 */
async function _removeTagsFromMany(files:TFile[], tags:string[], plugin: QuickTagPlugin){
	console.log("REMOVING TAGS")
	await _apply_bulk_changes(files, tags, plugin, _removeTags)
}


/** Consolidates the bulk processing for add/remove functions.
 * Add a progress bar in the status bar if there are lots of files
 * 
 * @param files 
 * @param tag 
 * @param plugin 
 * @param func 
 */
async function _apply_bulk_changes(files:TFile[], tags:string[], plugin:QuickTagPlugin, func:Function){
	let status_bar = plugin.addStatusBarItem();
	status_bar.createEl("span")
	let useStatusBar = false

	if (files.length > WOAH_LOTS_OF_FILES){
		new Notice("Processing " + files.length + " files... This might take a while. See status bar for progress.")
		useStatusBar = true
	}
	for (let i=0; i<files.length; i++){
		if(useStatusBar){
			let tag_text = tags.length == 1 ? tags[0] : tags.length.toString() + " tags"
			status_bar.setText(`Processing ${tag_text}: ${i + 1}/${files.length}`)
		}
		await func(files[i], tags)
	}

	status_bar.remove()
}


async function showStatusBarMenu(plugin:QuickTagPlugin){
	let statusBarRect = plugin._statusBarItem.parentElement?.getBoundingClientRect()
	let status_bar_top = statusBarRect ? statusBarRect.top : 30
	let statusBarIconRect = plugin._statusBarItem.getBoundingClientRect()
	let current_file = plugin.app.workspace.getActiveFile()


	plugin._statusBarItemMenu = new Menu()

	populateStatusBarTagStashIndicator(plugin._statusBarItemMenu, plugin)

	plugin._statusBarItemMenu.addItem((item) => {
		item
		  .setTitle("On active file...")
		  .setIsLabel(true)
	})

	if (current_file) {
		populateStatusBarMenuItems([current_file], plugin)
	}
	

	let centerRect = (statusBarIconRect.left - statusBarIconRect.right) / 2 + statusBarIconRect.left
	plugin._statusBarItemMenu.showAtPosition({
		x: centerRect,
		y: status_bar_top - 5,

	})
}


function wordWrap(str: string, max: number, br: string = '\n'){
	// https://www.30secondsofcode.org/js/s/word-wrap/
	return str.replace(new RegExp(`(?![^\\n]{1,${max}}$)([^\\n]{1,${max}})\\s`, 'g'), '$1' + br);
}

async function populateStatusBarMenuItems(files:TFile[], plugin: QuickTagPlugin){
	plugin._statusBarItemMenu
		.addItem((item) =>{
		item
		.setTitle("Add tag")
		.setIcon("plus")
		.onClick(() => {
			addTagsWithModal(plugin, files)
		})
	})

	let starredTags = plugin.settings.priorityTags

	let singleFile = files.length == 1
	let singleFileTags = [] as string[]
	if (singleFile){
		let tmp_gatherer = new TagsOnFiles
		singleFileTags = tmp_gatherer.retrieve_tags(plugin, files)
	}
	let operation = singleFile ? toggleTagOnFile : addTagsDirectly

	let buffer = plugin.settings.statusBarCount
	for (let i = 0; i < starredTags.length; i++){
		let t = starredTags[i]
		if(t.status_bar){
			if (buffer > 0){
				buffer--
				continue
			}
			plugin._statusBarItemMenu.addItem((item) =>{
				let title = `${t.tag_value}`
				let icon = 'plus'
				if (singleFile){
					let state = singleFileTags.includes(t.tag_value)
					icon = state ? 'minus' : 'plus'
				}
				item
				  .setTitle(title)
				  .setIcon(icon)
				  .onClick(async () => {
					operation(plugin, files, [t.tag_value])
				  })
			})
		}
	}

	plugin._statusBarItemMenu.addItem((item) =>{
		item
			.setTitle("Remove tag")
			.setIcon("minus")
			.onClick(() => {
			removeTagsWithModal(plugin, files)
			})
	})

}


/** Fix problems with processFrontMatter.
 * processFrontMatter does not work if there are newlines before the metadata
 * or spaces after the second set of dashes.
 * 
 * @param f 
 */
async function _cleanFile(f:TFile){
	let text = await this.app.vault.read(f)

	let modified = _cleanNoteContent(text)

	// if anything was changed, write it back to the file
	if(modified){
		console.log(`fixing up broken parts of ${f.basename}'s yaml...`)
		await this.app.vault.modify(f, text)
	}
}

/** Fix problems with processFrontMatter (extracted to separate plugin process from Obsidian code)
 * 
 * @param content "string representing the note's content"
 */
function _cleanNoteContent(content:string){
	let modified = false

	// first check newlines
	if(content[0] == '\n'){
		while(content[0] == '\n'){
			content = content.slice(1)
		}
		modified = true
	}

	// then check to make sure we have our yaml guiderails
	if(content.indexOf("---\n") == 0){
		let matches = content.match(/---\s*\n?/g)
		if(matches && matches[1] != "---\n" && matches[1] != "---"){  // if our second match isn't clean, fix it!
			content = content.replace(matches[1], "---\n")
			modified = true
		}
	}

	if(modified){
		return content
	} else {
		return false
	}
}

/** Unify tag formatting
 * 
 * @param tag string representing the name of a tag, with or without a # symbol
 * @returns tag with one # symbol at the front
 */
function _formatHashTag(tag:string){
		return tag.replace('#', '')
}


/** Collect all recognized tag list variations into one key
 * 
 * @param yaml - a single yaml dict 
 * @returns - a single modified yaml dict
 */
function _collectExistingTags(yml:any){
	// make the desired key, if it does not exist
	if (!yml.hasOwnProperty(TAG_KEY) || yml[TAG_KEY] === null){
		yml[TAG_KEY] = []
	} else {
		// catch existing string formatting that works in obsidian, but not javascript
		yml[TAG_KEY] = _conformToArray(yml[TAG_KEY])
	}

	yml = _emptyAlternateKeys(yml)
	yml[TAG_KEY].map((tag: string) => _formatHashTag(tag))

	return yml
}


/** Takes alternate spellings recognized by Obsidan and transfers them over to the correct yaml property
 * 
 * @param yml frontmatter object
 */
function _emptyAlternateKeys(yml: any){
	// get a list of any keys the yaml includes that we don't want
	let discovered_alternate_keys = TAG_CLEANUP_KEYS.filter((v: string) => Object.keys(yml).includes(v))
	
	for(let i=0;i<discovered_alternate_keys.length;i++){
		let otherTags = _conformToArray(yml[discovered_alternate_keys[i]])
		otherTags.forEach((tag: string) => {
			// dump non-duplicate tags from other keys into the desired key
			!yml[TAG_KEY].includes(tag) ? yml[TAG_KEY].push(tag) : console.log(tag + " already exists") 
		});

		delete yml[discovered_alternate_keys[i]]  // remove the undesired keys
	}
	return yml
  }


/** Fix comma or space seperated tags
 * Obsidian can store tags in the yaml header as a comma-separated or 
 * space-separated string. This function converts this string format into an array.
 * 
 * @param input - a string or array to be conformed
 * @returns - the conformed array
 */
function _conformToArray(input:string | Array<string>){
	let converted_array = typeof(input) === 'string' ? input.split(',').map(e => e.trim()) : input

	// Obsidian counts spaces in tags as separate tags, this breaks them out into individual items
	let separated_array: string[][] = []
	converted_array.forEach((str) => separated_array.push(str.split(' ')))
	let output = separated_array.flat(Infinity)
	
	return output ? output : []
}


/** Spawn a selection dialog and return a tag once selected
 * 
 * @param plugin the main Quick-Tagger plugin
 * @param gatherer a function that returns the list of tags to display in the QuickTagSelector
 * @param notes notes that this action will affect
 * @returns promise for a tag (string) selected from the modal
 */
function selectTag(plugin: QuickTagPlugin, gatherer?: TagGatherer, notes?: TFile[]): Promise<string>{
	let active_gatherer = gatherer ? gatherer : new AddTagList
	let active_notes = notes ? notes : new Array
	return new Promise((resolve) => {
		new QuickTagSelector(plugin, active_gatherer, (result: string) => {resolve(result)}, active_notes).open();
	})
}


/**
 * 
 */
function selectManyTags(plugin: QuickTagPlugin, context?: QuickTagSelectorLoop | null, gatherer?: TagGatherer, notes?: TFile[]): Promise<string[]>{
	let active_gatherer = gatherer ? gatherer: new AddTagList
	let active_notes = notes ? notes : new Array
	return new Promise((resolve) => {
		if (context){
			context.open()
		} else {
			new QuickTagSelectorLoop(plugin, active_gatherer, (result: string[]) => resolve(result), active_notes).open()
		}
	})
}

/** Spawn notification for user that tags were added/removed successfully
 * 
 * @param mode 
 * @param tag 
 * @param applicableFiles 
 */
function confirmationNotification(mode:string, tags:string[], applicableFiles: TFile[]){
	let notes = applicableFiles.length > 1 ? applicableFiles.length + " notes" : applicableFiles[0].basename
	let tofrom = mode == 'add' ? " added to " : " removed from "
	let tag_text = tags.length == 1 ? tags[0] : tags.length.toString() + " tags"
	if (tags[0] == "REMOVE ALL"){
		new Notice("All tags removed from " + notes)
	} else {
		new Notice(tag_text + tofrom + notes)
	}
}


/** Turn Obsidian command on or off for a starred tag
 * 
 * @param app 
 * @param plugin 
 * @param StarredTag 
 * @returns 
 */
function dynamicToggleCommand(plugin: QuickTagPlugin, StarredTag: StarredTag){
	let tag = StarredTag.tag_value.replace('#', '')
	let commandId = `quick-add-tag:${tag}`
	let fullId = `quick-tagger:${commandId}`
	let state = false

	if(plugin.app.commands.findCommand(fullId)) {
		delete plugin.app.commands.commands[fullId];
		delete plugin.app.commands.editorCommands[fullId];
	} else {
		plugin.addCommand({
			id: commandId,
			name: `Toggle #${tag}`,
			callback: () => {
				toggleTagOnActive(plugin, tag)
			}
		})
		state = true
	}
	return state
}


/** Add context menu items to a given menu
 * 
 */
function constructTaggerContextMenu(menu: Menu, files: TFile[], plugin: QuickTagPlugin, section="action"){
	menu.addItem((item) => {
		let subMenu = item
		  .setTitle("Quick Tag")
		  .setIcon("tag")
		  .setSection(section)
		  .setSubmenu()
		
		subMenu
		  .addItem((item: MenuItem) =>{
			item
			.setTitle("Tag " + files.length + " file(s) with...")
			.setIcon("plus")
			.onClick(() => {
				addTagsWithModal(plugin, files)
			})
		  })
		
		dynamicAddMenuItems(subMenu, files, plugin)

		subMenu.addItem((item: MenuItem) =>{
			item
			  .setTitle("Remove Tag from " + files.length + " file(s)...")
			  .setIcon("minus")
			  .onClick(() => {
				removeTagsWithModal(plugin, files)
			  })
		})
	})
}



/** Add menu items for configured starred tags
 * 
 * @param menu 
 * @param files 
 * @param plugin 
 */
function dynamicAddMenuItems(menu: Menu, files: TFile[], plugin: QuickTagPlugin){
	let starredTags = plugin.settings.priorityTags

	let singleFile = files.length == 1
	let singleFileTags = [] as string[]
	if (singleFile){
		let tmp_gatherer = new TagsOnFiles
		singleFileTags = tmp_gatherer.retrieve_tags(plugin, files)
	}
	let operation = singleFile ? toggleTagOnFile : addTagsDirectly

	starredTags.forEach((t) => {
		if(t.right_click){
			menu.addItem((item) =>{
				let title = `Tag with ${t.tag_value}`
				if (singleFile){
					let state = singleFileTags.includes(t.tag_value)
					title = state ? `Remove ${t.tag_value}` : `Add ${t.tag_value}`
				}
				item
				  .setTitle(title)
				  .setIcon("star")
				  .onClick(async () => {
					operation(plugin, files, [t.tag_value])
				  })
			})
		}
	})
}



/** Spawn confirmation dialogs waring users about removing all and bulk edits
 * 
 * @param mode 
 * @param tag 
 * @param quantity 
 * @returns 
 */
async function addDialogs(mode: string, tags: string[], quantity?: number){
	let verb = mode
	let tofrom = mode == 'add' ? " to " : " from "
	let confirm = true

	if (tags[0] == "REMOVE ALL"){
		let msg = "This will delete all tags on the active note(s), are you sure?"
		confirm = await adjust_tag_dialog(msg)
		verb = ""
	}
	if (!confirm) {return confirm}
	if (quantity && quantity > 1){
		let msg = "You are about to " + 
					verb + " " +
					(tags.length == 1 ? tags[0] : tags.length.toString() + " tags") +
					tofrom +
					quantity + " notes, are you sure?"
		confirm = await adjust_tag_dialog(msg)
	}
	return confirm
}


async function adjust_tag_dialog(msg: string){
	let confirm = false
	await new Promise((resolve) => {
		new ConfirmModal(this.app, (result) => (resolve(confirm = result)), msg).open()
	})
	return confirm
}



//// --------------- DIRECT COMMAND CALLS ----------------- /////

/** Convenience function to call modal, warnings, add tags, and then confirmation
 * 
 * @param plugin 
 * @param files 
 */
async function addTagsWithModal(plugin: QuickTagPlugin, files: TFile[]){
	let tag = await selectTag(plugin, new AddTagList, files)
	addTagsDirectly(plugin, files, [tag])
}


/** Convenience function to get active, then call tag selection dialog
 * 
 */
async function addTagWithModal(plugin: QuickTagPlugin){
	let currentFile = _getActiveFile()
	addTagsWithModal(plugin, currentFile)
}


/** Convenience function to call modal, warnings, remove tags, and then confirmation
 * 
 * @param plugin 
 * @param files 
 */
async function removeTagsWithModal(plugin: QuickTagPlugin, files: TFile[]){
	let tag = await selectTag(plugin, new TagsOnFiles, files)
	await removeTagsDirectly(plugin, files, [tag])
}


/** Convenience function to get active, then call tag selection dialog
 * 
 */
async function removeTagWithModal(plugin: QuickTagPlugin){
	let currentFile = _getActiveFile()
	await removeTagsWithModal(plugin, currentFile)
}


/** Add or remove the given tag on the active file
 * 
 * @param tag 
 */
function toggleTagOnActive(plugin: QuickTagPlugin, tag: string){
	let file = _getActiveFile()
	toggleTagOnFile(plugin, file, [tag])
}


function toggleTagOnFile(plugin: QuickTagPlugin, file: TFile[], tags: string[]){
	if (tags.length > 1) {
		new Notice("Quick Tagger ERRROR: Cannot toggle multiple tags!")
		return
	}
	update_last_used_tag(plugin, tags)
	let tag_added = _toggleTags(file, tags[0])
	tag_added[0] ? confirmationNotification('add', tags, file) : confirmationNotification('remove', tags, file)
}


async function _applyTagChanges(plugin: QuickTagPlugin, tags: string[], applicableFiles: TFile[], func: Function, verb: string){
	update_last_used_tag(plugin, tags)

	let formatted_tags = tags.map((t: string) => t.replace('#', ''))
	await func(applicableFiles, formatted_tags, plugin).then(
		() => confirmationNotification(verb, tags, applicableFiles)
	)
}


/** Add tags to files with appropriate warnings and notifications
 * 
 * @param plugin 
 * @param files 
 * @param tag 
 * @returns 
 */
async function addTagsDirectly(plugin: QuickTagPlugin, files: TFile[], tags: string[]){
	let applicableFiles = getFilteredWithoutTags(files, tags)

	if (applicableFiles.length == 0){
		new Notice("No file tags to change!")
		return
	}

	let confirm = await addDialogs('add', tags, files.length)

	if (confirm){
		_applyTagChanges(plugin, tags, applicableFiles, _addTagsToMany, 'add')
	}
}

/** Convenience function to add tag directly to a note
 *  
 * @param plugin 
 * @param tag 
 */
async function addTagsDirectlyToActive(plugin: QuickTagPlugin, tags: string[]){
	let file = _getActiveFile()
	addTagsDirectly(plugin, file, tags)
}


/** Remove tags from files with appropriate warnings and notifictions
 * 
 * @param plugin 
 * @param files 
 * @param tag 
 * @returns 
 */
async function removeTagsDirectly(plugin: QuickTagPlugin, files: TFile[], tags: string[]){
	let applicableFiles = getFilteredWithTags(files, tags)

	if (applicableFiles.length == 0){
		new Notice("No file tags to change!")
		return
	}

	let confirm = await addDialogs('remove', tags, applicableFiles.length)

	if (confirm){
		_applyTagChanges(plugin, tags, applicableFiles, _removeTagsFromMany, 'remove')
	}
}


/** Convenience function to remove tag directly from a note
 * 
 */
async function removeTagsDirectlyFromActive(plugin: QuickTagPlugin, tags: string[]){
	let file = _getActiveFile()
	removeTagsDirectly(plugin, file, tags)
}


async function update_last_used_tag(plugin: QuickTagPlugin, tags: string[]){
	if (tags.length > 1){
		// bail, we don't want to store multiple tags in this setting
		return
	}

	let tag = tags[0]
	plugin.settings.last_used_tag = tag
	await plugin.saveSettings()

	let commandId = 'repeat-last-tag'

	if(plugin.app.commands.findCommand(commandId)) {
		delete plugin.app.commands.commands[commandId];
		delete plugin.app.commands.editorCommands[commandId];
	}

	plugin.addCommand({
		id: commandId,
		name: `Toggle recently used tag (${tag})`,
		callback: () => {
			toggleTagOnActive(plugin, tag)
		}
	})
}


function modal_selection_is_special(str: string): boolean{
	return SPECIAL_COMMANDS.includes(str) || is_modal_selection_a_stash(str)
}