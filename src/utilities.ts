import{ Notice, App, TFile, Menu } from 'obsidian'
import QuickTagPlugin, { StarredTag } from "./main"
import { ConfirmModal, QuickTagSelector } from './modal'
import { AddTagList, TagGatherer, TagsOnFiles } from './tag_gatherers'
import { filterTag, getFilteredWithTag, getFilteredWithoutTag } from './file_filters'
import { WOAH_LOTS_OF_FILES } from './constants'
export { selectTag, addTagsWithModal, addTagWithModal, removeTagWithModal, removeTagsWithModal,
	toggleTagOnActive, toggleTagOnFile, dynamicToggleCommand, dynamicAddMenuItems }
export { _formatHashTag, _addFrontMatterTag, _cleanNoteContent, _getRemovalProcessor, 
	_removeAllFrontMatterTags, _removeFrontMatterTag }

const tag_key = 'tags'
const tag_cleanup = ['tag', 'Tag', 'Tags']


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
async function _addTag(thisFile: TFile, tag: string){
	this.tag = _formatHashTag(tag)
	await _cleanFile(thisFile)
	await this.app.fileManager.processFrontMatter(thisFile, _addFrontMatterTag.bind(this))
}


/** Add tag to a note; extracted from Obsidian functionality
 * 
 * @param frontmatter an object with a tags key
 */
function _addFrontMatterTag(frontmatter: {tags: string[]}){
	frontmatter = _collectExistingTags(frontmatter);
	frontmatter[tag_key] = frontmatter[tag_key].map((t:string) => _formatHashTag(t))
	frontmatter[tag_key].push(this.tag)
}


/** Remove a tag from a note
 * 
 * @param tag the tag to remove
 */
async function _removeTag(thisFile: TFile, tag:string){
	this.tag = _formatHashTag(tag)
	await _cleanFile(thisFile)
	let processor = _getRemovalProcessor(tag)
	await this.app.fileManager.processFrontMatter(thisFile, processor.bind(this))
}

/** Select the function to be used with tag removal
 * 
 * @param tag 
 * @returns 
 */
function _getRemovalProcessor(tag: string){
	if (tag != "REMOVE ALL"){
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
	let tags = frontmatter[tag_key]
	tags = tags.map((t:string) => _formatHashTag(t))
	let indx = tags.indexOf(this.tag, 0)
	if (indx > -1){
		tags.splice(indx, 1)
	}
	frontmatter[tag_key] = tags
}


/** Remove all tags from a note; separated from Obsidian logic
 * 
 */
function _removeAllFrontMatterTags(frontmatter: {tags: string[]}) {
	frontmatter[tag_key] = []
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
		let exists = filterTag(files[i], `#${tag}`)
		if(!exists){
			_addTag(files[i], tag)
			tag_added++
		} else {
			_removeTag(files[i], tag)
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
async function _addTagToMany(files:TFile[], tag:string, plugin: QuickTagPlugin){
	console.log("ADDING TAGS")
	await _apply_bulk_changes(files, tag, plugin, _addTag)
}


/** Loop over files and remove tags
 * 
 * @param files array of files to edit
 * @param tag tag to remove
 * @param plugin a reference to the plugin (used to update status bar)
 */
async function _removeTagFromMany(files:TFile[], tag:string, plugin: QuickTagPlugin){
	console.log("REMOVING TAGS")
	await _apply_bulk_changes(files, tag, plugin, _removeTag)
}


/** Consolidates the bulk processing for add/remove functions.
 * Add a progress bar in the status bar if there are lots of files
 * 
 * @param files 
 * @param tag 
 * @param plugin 
 * @param func 
 */
async function _apply_bulk_changes(files:TFile[], tag:string, plugin:QuickTagPlugin, func:Function){
	let status_bar = plugin.addStatusBarItem();
	status_bar.createEl("span")
	let useStatusBar = false

	if (files.length > WOAH_LOTS_OF_FILES){
		new Notice("Processing " + files.length + " files... This might take a while. See status bar for progress.")
		useStatusBar = true
	}
	for (let i=0; i<files.length; i++){
		if(useStatusBar){
			status_bar.setText(`Processing ${tag}: ${i + 1}/${files.length}`)
		}
		await func(files[i], tag)
	}

	status_bar.remove()
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


/** Collect all recognized tag list letiations into one key
 * 
 * @param yaml - a single yaml dict 
 * @returns - a single modified yaml dict
 */
function _collectExistingTags(yml:any){
	// make the desired key, if it does not exist
	if (!yml.hasOwnProperty(tag_key) || yml[tag_key] === null){
		yml[tag_key] = []
	} else {
		// catch existing string formatting that works in obsidian, but not javascript
		yml[tag_key] = _conformToArray(yml[tag_key])
	}

	// get a list of any keys the yaml includes that we don't want
	let alternate_keys = tag_cleanup.filter(v => Object.keys(yml).includes(v))
	
	for(let i=0;i<alternate_keys.length;i++){
		let otherTags = _conformToArray(yml[alternate_keys[i]])
		otherTags.forEach((tag: string) => {
			// dump non-duplicate tags from other keys into the desired key
			!yml[tag_key].includes(tag) ? yml[tag_key].push(tag) : console.log(tag + " already exists") 
		});

		delete yml[alternate_keys[i]]  // remove the undesired keys
	}

	for(let i=0;i<yml[tag_key].length;i++){
		yml[tag_key][i] = _formatHashTag(yml[tag_key][i])
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
	let output = typeof(input) === 'string' ? input.split(',').map(e => e.trim()) : input
    if (output.length == 1){
		// if we have one string, split it by spaces to confirm we don't have multiple tags
		output = output[0].split(' ').map(e => e.trim())
	}
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
	let active_notes = notes ? notes : []
	return new Promise((resolve) => {
		new QuickTagSelector(plugin, active_gatherer, (result) => {resolve(result)}, active_notes).open();
	})
}


/** Spawn notification for user that tags were added/removed successfully
 * 
 * @param mode 
 * @param tag 
 * @param applicableFiles 
 */
function confirmationNotification(mode:string, tag:string, applicableFiles: TFile[]){
	let notes = applicableFiles.length > 1 ? applicableFiles.length + " notes" : applicableFiles[0].basename
	let tofrom = mode == 'add' ? " added to " : " removed from "
	if (tag == "REMOVE ALL"){
		new Notice("All tags removed from " + notes)
	} else {
		new Notice(tag + tofrom + notes)
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
				  .setIcon("tag")
				  .onClick(async () => {
					operation(plugin, files, t.tag_value)
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
async function addDialogs(mode: string, tag: string, quantity?: number){
	let verb = mode
	let tofrom = mode == 'add' ? " to " : " from "
	let confirm = true

	if (tag == "REMOVE ALL"){
		let msg = "This will delete all tags on the active note(s), are you sure?"
		confirm = await adjust_tag_dialog(msg)
		console.log("First responders")
		console.log(confirm)
		verb = ""
	}
	if (!confirm) {return confirm}
	if (quantity && quantity > 1){
		let msg = "You are about to " + 
					verb + " " +
					tag +
					tofrom +
					quantity + " notes, are you sure?"
		confirm = await adjust_tag_dialog(msg)
		console.log("second responders")
		console.log(confirm)
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
	addTagsDirectly(plugin, files, tag)
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
	await removeTagsDirectly(plugin, files, tag)
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
	toggleTagOnFile(plugin, file, tag)
}


function toggleTagOnFile(plugin: QuickTagPlugin, file: TFile[], tag: string){
	update_last_used_tag(plugin, tag)
	let tag_added = _toggleTags(file, tag)
	tag_added[0] ? confirmationNotification('add', tag, file) : confirmationNotification('remove', tag, file)
}


/** Add tags to files with appropriate warnings and notifications
 * 
 * @param plugin 
 * @param files 
 * @param tag 
 * @returns 
 */
async function addTagsDirectly(plugin: QuickTagPlugin, files: TFile[], tag: string){
	let applicableFiles = getFilteredWithoutTag(files, tag)

	if (applicableFiles.length == 0){
		new Notice("No file tags to change!")
		return
	}

	console.log("come now, let's pause")
	let confirm = await addDialogs('add', tag, files.length)
	console.log("Here's the cheese")
	console.log(confirm)

	if (confirm){
		update_last_used_tag(plugin, tag)
		await _addTagToMany(applicableFiles, tag.replace('#', ''), plugin).then(
			() => confirmationNotification('add', tag, applicableFiles)
		)
	}
}

/** Convenience function to add tag directly to a note
 *  
 * @param plugin 
 * @param tag 
 */
async function addTagDirectly(plugin: QuickTagPlugin, tag: string){
	let file = _getActiveFile()
	addTagsDirectly(plugin, file, tag)
}


/** Remove tags from files with appropriate warnings and notifictions
 * 
 * @param plugin 
 * @param files 
 * @param tag 
 * @returns 
 */
async function removeTagsDirectly(plugin: QuickTagPlugin, files: TFile[], tag: string){
	let applicableFiles = getFilteredWithTag(files, tag)

	if (applicableFiles.length == 0){
		new Notice("No file tags to change!")
		return
	}

	let confirm = await addDialogs('remove', tag, applicableFiles.length)

	if (confirm){
		update_last_used_tag(plugin, tag)
		await _removeTagFromMany(applicableFiles, tag.replace('#', ''), plugin).then(
			() => confirmationNotification('remove', tag, applicableFiles)
		)
	}
}


/** Convenience function to remove tag directly from a note
 * 
 */
async function removeTagDirectly(plugin: QuickTagPlugin, tag: string){
	let file = _getActiveFile()
	removeTagsDirectly(plugin, file, tag)
}


async function update_last_used_tag(plugin: QuickTagPlugin, tag: string){
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