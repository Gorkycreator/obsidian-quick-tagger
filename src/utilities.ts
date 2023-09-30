import{ Notice, App, TFile, Menu } from 'obsidian'
import QuickTagPlugin, { StarredTag } from "./main"
import { ConfirmModal, QuickTagSelector } from './modal'
import { getTagList, getTagsOnFiles } from './tag_gatherers'
import { filterTag, getFilteredWithTag, getFilteredWithoutTag } from './file_filters'
export { selectTag, addTagsWithModal, addTagWithModal, removeTagWithModal, removeTagsWithModal,
	toggleTagOnActive, dynamicToggleCommand, dynamicAddMenuItems }

const tag_key = 'tags'
const tag_cleanup = ['tag', 'Tag', 'Tags']
const WOAH_LOTS_OF_FILES = 100


/** Gets the active file
 * 
 * @returns Tfile array
 */
function _getActiveFile() {
	var thisFile = this.app.workspace.getActiveFile()
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
	tag = _formatHashTag(tag)
	await _cleanFile(thisFile)
	await this.app.fileManager.processFrontMatter(thisFile, (frontmatter: object) => {
		frontmatter = _collectExistingTags(frontmatter);
		frontmatter[tag_key] = frontmatter[tag_key].map((t) => _formatHashTag(t))
		frontmatter[tag_key].push(tag)
	})
}


/** Remove a tag from a note
 * 
 * @param tag the tag to remove
 */
async function _removeTag(thisFile: TFile, tag:string){
	tag = tag != "REMOVE ALL" ? _formatHashTag(tag) : tag
	await _cleanFile(thisFile)
	var processor = (frontmatter: object) => {
		frontmatter = _collectExistingTags(frontmatter)
		var tags = frontmatter[tag_key]
		tags = tags.map((t:string) => _formatHashTag(t))
		var indx = tags.indexOf(tag, 0)
		if (indx > -1){
			tags.splice(indx, 1)
		}
		frontmatter[tag_key] = tags
	}
	if (tag == "REMOVE ALL"){
		console.log("removing all tags.....")
		processor = (frontmatter: object) => {
			frontmatter[tag_key] = []
		}
	}
	await this.app.fileManager.processFrontMatter(thisFile, processor)
}

/** Add or remove the given tag on the given files
 * 
 * @param files 
 * @param tag 
 * @returns number added, number removed 
 */
function _toggleTags(files: TFile[], tag: string): number[] {
	var tag = tag.replace('#', '')
	var tag_added = 0
	var tag_removed = 0

	for(var i=0; i<files.length; i++){
		var exists = filterTag(files[i], `#${tag}`)
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
	var logger = plugin.addStatusBarItem();
	logger.createEl("span")
	var useStatusBar = false

	if (files.length > WOAH_LOTS_OF_FILES){
		new Notice("Processing " + files.length + " files... This might take a while. See status bar for progress.")
		useStatusBar = true
	}
	for (var i=0; i<files.length; i++){
		if(useStatusBar){
			logger.setText(`Processing ${tag}: ${i + 1}/${files.length}`)
		}
		await func(files[i], tag)
	}

	logger.remove()
}


/** Fix problems with processFrontMatter.
 * processFrontMatter does not work if there are newlines before the metadata
 * or spaces after the second set of dashes.
 * 
 * @param f 
 */
async function _cleanFile(f:TFile){
	let text = await this.app.vault.read(f)
	var modified = false

	// first check newlines
	if(text[0] == '\n'){
		while(text[0] == '\n'){
			text = text.slice(1)
		}
		modified = true
	}

	// then check to make sure we have our yaml guiderails
	if(text.indexOf("---\n") == 0){
		var matches = text.match(/---\s*\n?/g)
		if(matches[1] != "---\n" && matches[1] != "---"){  // if our second match isn't clean, fix it!
			text = text.replace(matches[1], "---\n")
			modified = true
		}
	}

	// if anything was changed, write it back to the file
	if(modified){
		console.log(`fixing up broken parts of ${f.basename}'s yaml...`)
		await this.app.vault.modify(f, text)
	}
}

/** Unify tag formatting
 * 
 * @param tag string representing the name of a tag, with or without a # symbol
 * @returns tag with one # symbol at the front
 */
function _formatHashTag(tag:string){
	if (tag[0] != "#"){
		return `#${tag}`
	} else {
		return tag
	}
}


/** Collect all recognized tag list variations into one key
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
	var alternate_keys = tag_cleanup.filter(v => Object.keys(yml).includes(v))
	
	for(var i=0;i<alternate_keys.length;i++){
		var otherTags = _conformToArray(yml[alternate_keys[i]])
		otherTags.forEach((tag: string) => {
			// dump non-duplicate tags from other keys into the desired key
			!yml[tag_key].includes(tag) ? yml[tag_key].push(tag) : console.log(tag + " already exists") 
		});

		delete yml[alternate_keys[i]]  // remove the undesired keys
	}

	for(var i=0;i<yml[tag_key].length;i++){
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
	var output = typeof(input) === 'string' ? input.split(',').map(e => e.trim()) : input
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
async function selectTag(plugin: QuickTagPlugin, gatherer: Function, notes?: TFile[]): Promise<string>{
	return new Promise((resolve) => {
		const modal = new QuickTagSelector(plugin, gatherer, notes ? notes : []);

		// overwrite onChooseItem method so we can insert the resolve
		modal.onChooseItem = (tag: string) => {
			resolve(tag)
		}
		modal.open()
	})
}


/** Spawn notification for user that tags were added/removed successfully
 * 
 * @param mode 
 * @param tag 
 * @param applicableFiles 
 */
function confirmationNotification(mode:string, tag:string, applicableFiles: TFile[]){
	var notes = applicableFiles.length > 1 ? applicableFiles.length + " notes" : applicableFiles[0].basename
	var tofrom = mode == 'add' ? " added to " : " removed from "
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
function dynamicToggleCommand(app: App, plugin: QuickTagPlugin, StarredTag: StarredTag){
	var tag = StarredTag.tag_value.replace('#', '')
	var commandId = `quick-add-tag:${tag}`
	var fullId = `obsidian-quick-tagger:${commandId}`
	var state = false

	if(app.commands.findCommand(fullId)) {
		delete app.commands.commands[fullId];
		delete app.commands.editorCommands[fullId];
	} else {
		plugin.addCommand({
			id: commandId,
			name: `Toggle #${tag}`,
			callback: () => {
				toggleTagOnActive(tag)
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
	var starredTags = plugin.settings.priorityTags
	starredTags.forEach((t) => {
		if(t.right_click){
			menu.addItem((item) =>{
				item
				  .setTitle(`Tag with ${t.tag_value}`)
				  .setIcon("tag")
				  .onClick(async () => {
					addTagsDirectly(plugin, files, t.tag_value)
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
	var verb = mode
	var tofrom = mode == 'add' ? " to " : " from "
	var confirm = true

	if (tag == "REMOVE ALL"){
		var msg = "This will delete all tags on the current note(s), are you sure?"
		await new Promise((resolve) => {  // add a promise to wait for confirmation
			new ConfirmModal(app, (result) => (resolve(confirm = result)), msg).open()
		})
		verb = ""
	}
	if (!confirm) {return confirm}
	if (quantity && quantity > 1){
		var msg = "You are about to " + 
					verb + " " +
					tag +
					tofrom +
					quantity + " notes, are you sure?"
		await new Promise((resolve) => {  // add a promise to wait for confirmation
			new ConfirmModal(app, (result) => (resolve(confirm = result)), msg).open()
		})
	}
	return confirm
}


//// --------------- DIRECT COMMAND CALLS ----------------- /////

/** Convenience function to call modal, warnings, add tags, and then confirmation
 * 
 * @param plugin 
 * @param files 
 */
async function addTagsWithModal(plugin: QuickTagPlugin, files: TFile[]){
	var tag = await selectTag(plugin, getTagList, files)
	addTagsDirectly(plugin, files, tag)
}


/** Convenience function to get active, then call tag selection dialog
 * 
 */
async function addTagWithModal(plugin: QuickTagPlugin){
	var currentFile = _getActiveFile()
	addTagsWithModal(plugin, currentFile)
}


/** Convenience function to call modal, warnings, remove tags, and then confirmation
 * 
 * @param plugin 
 * @param files 
 */
async function removeTagsWithModal(plugin: QuickTagPlugin, files: TFile[]){
	var tag = await selectTag(plugin, getTagsOnFiles, files)
	removeTagsDirectly(plugin, files, tag)
}


/** Convenience function to get active, then call tag selection dialog
 * 
 */
async function removeTagWithModal(plugin: QuickTagPlugin){
	var currentFile = _getActiveFile()
	removeTagsWithModal(plugin, currentFile)
}


/** Add or remove the given tag on the active file
 * 
 * @param tag 
 */
function toggleTagOnActive(tag: string){
	var file = _getActiveFile()
	var tag_added = _toggleTags(file, tag)
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
	var applicableFiles = getFilteredWithoutTag(files, tag)

	if (applicableFiles.length == 0){
		new Notice("No file tags to change!")
		return
	}

	var confirm = await addDialogs('add', tag, applicableFiles.length)

	if (confirm || applicableFiles.length == 1){
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
	var file = _getActiveFile()
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
	var applicableFiles = getFilteredWithTag(files, tag)

	if (applicableFiles.length == 0){
		new Notice("No file tags to change!")
		return
	}

	var confirm = await addDialogs('remove', tag, applicableFiles.length)

	if (confirm || applicableFiles.length == 1){
		await _removeTagFromMany(applicableFiles, tag.replace('#', ''), plugin).then(
			() => confirmationNotification('remove', tag, applicableFiles)
		)
	}
}


/** Convenience function to remove tag directly from a note
 * 
 */
async function removeTagDirectly(plugin: QuickTagPlugin, tag: string){
	var file = _getActiveFile()
	removeTagsDirectly(plugin, file, tag)
}
