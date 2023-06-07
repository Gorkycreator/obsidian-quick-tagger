import{parseYaml, stringifyYaml, MarkdownView, Notice, getAllTags, App, Plugin, TFile} from 'obsidian'
import {QuickTaggerSettings} from "./main"
export { getActiveFile, addTagToActive, collectExistingTags, getTagList, removeTagFromActive }

const tag_key = 'tags'
const tag_cleanup = ['tag', 'Tag', 'Tags']


/**
 * Gets the active file
 * @returns Tfile or undefined
 */
function getActiveFile() {
	var thisFile = this.app.workspace.getActiveFile()
	if(thisFile instanceof TFile) {
		return thisFile
	} else {
		new Notice("No file open!")
		return undefined
	}
}


/**
 * Edit the yaml header of many files ===============> NOT FINISHED
 * @param notes - list of notes to process
 * @param operation - function to process them. Must take a single yaml dict and return a modified yaml dict.
 */
function editMultipleYaml(notes: Array<TFile>, operation: Function) {
	for (let i=0; i < notes.length; i++){
		this.app.fileManager.processFrontMatter(notes[i], operation)
	}
}


/**
 * Adds a given tag to the active note
 * @param tag the tag to add to the note
 */
function addTagToActive(tag:string){
	var activeFile = getActiveFile()
	if(activeFile){
		this.app.fileManager.processFrontMatter(activeFile, (frontmatter: object) => {
			frontmatter = collectExistingTags(frontmatter)
			if(!frontmatter[tag_key].includes(tag)){
				frontmatter[tag_key].push(tag)
			} else {
				new Notice(activeFile?.basename + ' already tagged with "#' + tag + '"')
			}
		})
	}
}


/**
 * Removes a given tag from the active note
 * @param tag the tag to remove
 */
function removeTagFromActive(tag:string){
	var activeFile = getActiveFile()
	if(activeFile){
		var processor = (frontmatter: object) => {
			frontmatter = collectExistingTags(frontmatter)
			var tags = frontmatter[tag_key]
			var indx = tags.indexOf(tag, 0)
			if (indx > -1){
				tags.splice(indx, 1)
			}
		}
		if (tag == "REMOVE ALL"){  // TODO: add confirmation dialog for this one...
			processor = (frontmatter: object) => {
				frontmatter = collectExistingTags(frontmatter)
				frontmatter[tag_key] = []
			}
		}
		this.app.fileManager.processFrontMatter(activeFile, processor)
	}
}


/**
 * Collect all tag keys into one key
 * @param yaml - a single yaml dict 
 * @returns - a single modified yaml dict
 */
function collectExistingTags(yml:any){
	console.log(yml)
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
	return output ? output : []
}


/**
 * Gets a list of all tags in Obsidian with the priority tags listed first
 * @param app 
 * @param settings 
 * @returns 
 */
function getTagList(app: App, settings: QuickTaggerSettings){
	var tagSettings = conformToArray(settings.tags)
	var tag_array = tagSettings.map((e) => e.replace('#', ''))
	                           .filter((e) => e)
							   .map((e) => '#' + e)
	
	if (!settings.all_tags){
		return tag_array
	}
	
  var tag_dict = app.metadataCache.getTags()
	for (const key in tag_dict) {
		if (tag_dict.hasOwnProperty(key)) {
			if (tag_array.indexOf(key) == -1){
				tag_array.push(key)
			}
		}
	}
	return tag_array
}


/**
 * Gets a list of tags from the active file
 * @param app 
 * @param settings 
 * @returns 
 */
export function getTagsOnActive(app: App, settings: QuickTaggerSettings){
    // TODO: this can be updated to work with category tags (user creates template note with categores
    //       and this gets existing tags on that note?)
	var activeFile = getActiveFile()
	var cache = this.app.metadataCache.getFileCache(activeFile);
    var tag_array = cache?.frontmatter?.tags || [];
	tag_array = tag_array.map((e) => e.replace('#', '')).filter((e) => e).map((e) => '#' + e)
	tag_array.push('REMOVE ALL')
	return tag_array
}
