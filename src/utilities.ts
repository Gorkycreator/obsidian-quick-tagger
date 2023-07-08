import{parseYaml, stringifyYaml, MarkdownView, Notice, getAllTags, App, Plugin, TFile, parseFrontMatterTags, MenuItem, Menu } from 'obsidian'
import QuickTagPlugin, {QuickTaggerSettings, PriorityTag} from "./main"
import { QuickTagSelector, ConfirmModal } from './modal'
import { getPriority } from 'os'
export { getActiveFile, addTagToMany, collectExistingTags, getTagList, removeTagFromMany, getTagsOnFiles, getFilteredWithoutTag, getFilteredWithTag,
	onlyTaggableFiles, selectTag, getNonStarredTags, dynamicToggleCommand, dynamicAddMenuItems, toggleTag }

const tag_key = 'tags'
const tag_cleanup = ['tag', 'Tag', 'Tags']
const SPECIAL_COMMANDS = ['REMOVE ALL']
const WOAH_LOTS_OF_FILES = 100


/**
 * Gets the active file
 * @returns Tfile array
 */
function getActiveFile() {
	var thisFile = this.app.workspace.getActiveFile()
	if(thisFile instanceof TFile) {
		return [thisFile]
	} else {
		new Notice("No file open!")
		return [] as TFile[]
	}
}


/**
 * Adds a tag to a file
 * @param thisFile the file to edit
 * @param tag the tag to add
 */
async function addTag(thisFile: TFile, tag: string){
	await cleanFile(thisFile)
	await this.app.fileManager.processFrontMatter(thisFile, (frontmatter: object) => {
		frontmatter = collectExistingTags(frontmatter);
		frontmatter[tag_key].push(tag)
	})
}


/**
 * Loops over files and adds tags
 * @param files array of files to edit
 * @param tag tag to add
 * @param plugin a reference to the plugin (used to update status bar)
 */
async function addTagToMany(files:TFile[], tag:string, plugin: QuickTagPlugin){
	console.log("ADDING TAGS")
	await apply_bulk_changes(files, tag, plugin, addTag)
}


/**
 * Loops over files and removes tags
 * @param files array of files to edit
 * @param tag tag to remove
 * @param plugin a reference to the plugin (used to update status bar)
 */
async function removeTagFromMany(files:TFile[], tag:string, plugin: QuickTagPlugin){
	console.log("REMOVING TAGS")
	await apply_bulk_changes(files, tag, plugin, removeTag)
}


/**
 * Consolidates the bulk processing for add/remove
 * @param files 
 * @param tag 
 * @param plugin 
 * @param func 
 */
async function apply_bulk_changes(files:TFile[], tag:string, plugin:QuickTagPlugin, func:Function){
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



/**
 * processFrontMatter does not work if there are newlines before the metadata
 * or spaces after the second set of dashes. Fix these problems.
 * @param fileList 
 */
async function cleanFile(f:TFile){
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


/**
 * Remove a tag from a note
 * @param tag the tag to remove
 */
async function removeTag(thisFile: TFile, tag:string){
	await cleanFile(thisFile)
	var processor = (frontmatter: object) => {
		frontmatter = collectExistingTags(frontmatter)
		var tags = frontmatter[tag_key]
		var indx = tags.indexOf(tag, 0)
		if (indx > -1){
			tags.splice(indx, 1)
		}
	}
	if (tag == "REMOVE ALL"){
		processor = (frontmatter: object) => {
			frontmatter[tag_key] = []
		}
	}
	await this.app.fileManager.processFrontMatter(thisFile, processor)
}


/**
 * Collect all tag keys into one key
 * @param yaml - a single yaml dict 
 * @returns - a single modified yaml dict
 */
function collectExistingTags(yml:any){
	// make the desired key, if it does not exist
	if (!yml.hasOwnProperty(tag_key)){
		yml[tag_key] = []
	} else {
		// catch existing string formatting that works in obsidian, but not javascript
		yml[tag_key] = conformToArray(yml[tag_key])
	}

	// filter to any keys the yaml includes that we don't want
	var alternate_keys = tag_cleanup.filter(v => Object.keys(yml).includes(v))
	
	for(var i=0;i<alternate_keys.length;i++){
		var otherTags = conformToArray(yml[alternate_keys[i]])
		otherTags.forEach((element: string) => {
			// dump non-duplicate tags from other keys into the desired key
			!yml[tag_key].includes(element) ? yml[tag_key].push(element) : console.log(element + " already exists") 
		});

		delete yml[alternate_keys[i]]  // remove the undesired keys
	}

	return yml
  }

/**
 * Obsidian can store tags in the yaml header as a comma-separated string. This function converts this string format into an array
 * @param input - a string or array to be conformed
 * @returns - the conformed array
 */
function conformToArray(input:string | Array<string>){
	var output = typeof(input) === 'string' ? input.split(',').map(e => e.trim()) : input
    if (output.length == 1){
		output = output[0].split(' ').map(e => e.trim())
	}
	return output ? output : []
}


/**
 * Gets a list of all tags in Obsidian with the priority tags listed first
 * @param app 
 * @param settings 
 * @returns 
 */
function getTagList(app: App, settings: QuickTaggerSettings, fileList?:TFile[]){
	// TODO: add filtering to remove tags that are already on the active file?
	var tagSettings = getPriorityTags(settings, 'cut_in_line')
	var tag_array = tagSettings.map((e) => e.replace('#', ''))
	                           .filter((e) => e)
							   .map((e) => '#' + e)
	
	if (!settings.all_tags){
		return tag_array
	}
	
    var tag_cache = getTagsFromAppCache()
	tag_cache.sort()
	tag_cache.forEach(tag => {
		if (tag_array.indexOf(tag) == -1){
			tag_array.push(tag)
		}
	})
	return tag_array
}


function getNonStarredTags(app: App, settings: QuickTaggerSettings, fileList?:TFile[]){
	var tag_array = getTagsFromAppCache()
	console.log(tag_array)
	var starredTags = getPriorityTags(settings)
	starredTags.forEach(t => tag_array.remove(t))
	tag_array.sort()
	return tag_array
}



function getTagsFromAppCache(){
	var results = [] as string[]
	for (const key in app.metadataCache.getTags()){
		results.push(key)
	}
	return results
}


function getPriorityTags(settings: QuickTaggerSettings, filter?:string){
	var results = [] as string[]
	settings.priorityTags.forEach(t => filter ? t[filter as keyof PriorityTag] ? results.push(t.tag_value) : null : results.push(t.tag_value))
	return results
}


/**
 * Gets a list of tags from the given files
 * @param app 
 * @param settings 
 * @param fileList
 * @returns 
 */
function getTagsOnFiles(app: App, settings: QuickTaggerSettings, fileList:TFile[]){
	var tag_array = [] as string[]
	fileList.forEach((f) =>{
		var cache = this.app.metadataCache.getFileCache(f)
		var new_tags = parseFrontMatterTags(cache.frontmatter)
		if(new_tags){
			new_tags.map((e) => e.replace('#', '')).filter((e) => e).map((e) => '#' + e)
			new_tags.forEach((item) =>{
				!tag_array.includes(item) ? tag_array.push(item) : undefined
			})
		}
	})
	tag_array.push('REMOVE ALL')
	return tag_array
}


function getFilteredWithoutTag(fileList:TFile[], tag:string){
	if (SPECIAL_COMMANDS.includes(tag)){ return fileList }
	var resultList = fileList.filter(file => filterTag(file, tag) == false)
	return resultList
}


function getFilteredWithTag(fileList:TFile[], tag:string){
	if (SPECIAL_COMMANDS.includes(tag)){ return fileList }
	var resultList = fileList.filter(file => filterTag(file, tag) == true)
	return resultList
}


function filterTag(thisFile: TFile, tag: string){
	var cache = this.app.metadataCache.getFileCache(thisFile)
	var existing_tags = parseFrontMatterTags(cache.frontmatter)
	if (existing_tags?.includes(tag)){
		return true
	} else {
		return false
	}
}

function onlyTaggableFiles(fileList: TFile[]){
	var resultList = fileList.filter(file => isFile(file) == true && file.extension == "md")
	return resultList
}

function isFile(thisFile: TFile){
	return thisFile.extension ? true : false
}


async function selectTag(plugin: QuickTagPlugin): Promise<string>{
	return new Promise((resolve, reject) => {
		const modal = new QuickTagSelector(plugin, [], 'select');

		// overwrite onChooseItem method so that we can nab the tag when it's selected and pass it back
		modal.onChooseItem = (tag: string) => {
			console.log("SELCT TAG FUNCTION")
			console.log(tag)
			resolve(tag)
		}
		modal.open()
	})
}


function dynamicToggleCommand(app: App, plugin: QuickTagPlugin, priorityTag: PriorityTag){
	var tag = priorityTag.tag_value.replace('#', '')
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
				var currentFile = getActiveFile()[0]
				toggleTag(currentFile, tag)
			}
		})
		state = true
	}
	return state
}


function dynamicAddMenuItems(menu: Menu, files: TFile[], plugin: QuickTagPlugin){
	var starredTags = plugin.settings.priorityTags
	starredTags.forEach((t) => {
		if(t.right_click){
			menu.addItem((item) =>{
				item
				  .setTitle(`Tag with ${t.tag_value}`)
				  .setIcon("tag")
				  .onClick(async () => {
					var applicableFiles = getFilteredWithoutTag(files, t.tag_value)

					if (applicableFiles.length == 0){
						new Notice("No file tags to change!")
						return
					}

					var confirm = await addDialogs('add', t.tag_value, applicableFiles.length)

					if (confirm || applicableFiles.length == 1){
						await addTagToMany(applicableFiles, t.tag_value.replace('#', ''), plugin).then(
							() => confirmationNotification('add', t.tag_value, applicableFiles)
						)
					}
				  })
			})
		}
	})
}


function toggleTag(file: TFile, tag: string){
	var tag = tag.replace('#', '')
	var exists = filterTag(file, `#${tag}`)
	if(!exists){
		addTag(file, tag)
	} else {
		removeTag(file, tag)
	}
	new Notice(!exists ? `Added #${tag} to ${file.basename}` : `Removed #${tag} from ${file.basename}`)
}



async function addDialogs(mode: string, tag: string, quantity?: number){
	var verb = mode
	var tofrom = mode == 'add' ? " to " : " from "
	var confirm = false

	if (tag == "REMOVE ALL"){
		var msg = "This will delete all tags on the current note(s), are you sure?"
		await new Promise((resolve) => {  // add a promise to wait for confirmation
			new ConfirmModal(app, (result) => (resolve(confirm = result)), msg).open()
		})
		verb = ""
	}
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


function confirmationNotification(mode:string, tag:string, applicableFiles: TFile[]){
	var notes = applicableFiles.length > 1 ? applicableFiles.length + " notes" : applicableFiles[0].basename
	var tofrom = mode == 'add' ? " added to " : " removed from "
	if (tag == "REMOVE ALL"){
		new Notice("All tags removed from " + notes)
	} else {
		new Notice(tag + tofrom + notes)
	}
}