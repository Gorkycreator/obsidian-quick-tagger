import{parseYaml, stringifyYaml, MarkdownView, Notice, getAllTags, App, Plugin, TFile, parseFrontMatterTags } from 'obsidian'
import {QuickTaggerSettings} from "./main"
export { getActiveFile, addTagToMany, collectExistingTags, getTagList, removeTagFromMany, getTagsOnFiles }

const tag_key = 'tags'
const tag_cleanup = ['tag', 'Tag', 'Tags']


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
function addTag(thisFile: TFile, tag: string){
	this.app.fileManager.processFrontMatter(thisFile, (frontmatter: object) => {
		frontmatter = collectExistingTags(frontmatter)
		if(!frontmatter[tag_key].includes(tag)){
			frontmatter[tag_key].push(tag)
		} else {
			new Notice(thisFile?.basename + ' already tagged with "#' + tag + '"')
		}
	})
}


/**
 * Loops over files and adds tags
 * @param files array of files to edit
 * @param tag tag to add to them
 */
async function addTagToMany(files:Array<TFile>, tag:string){
	await cleanFiles(files).then(() => {
		files.forEach((f) => {
			addTag(f, tag)
		})
	})
	if(files.length > 1){
		new Notice(files.length + ' notes tagged with "#' + tag + '"')
	}
}


async function removeTagFromMany(files:TFile[], tag:string){
	await cleanFiles(files).then(() => {
		files.forEach((f) => {
			removeTag(f, tag)
		})
	})
	if(files.length > 1){
		new Notice('"' + tag + '" removed from ' + files.length + ' notes')
	}
}


/**
 * processFrontMatter does not work if there are newlines before the metadata. Clear all newlines at the start of the document
 * @param fileList 
 */
async function cleanFiles(fileList:TFile[]){
	for(const f of fileList){
		let text = await this.app.vault.read(f)
		while(text[0] == '\n'){
			text = text.slice(1)
		}
		await this.app.vault.modify(f, text)
	}
}


/**
 * Remove a tag from a note
 * @param tag the tag to remove
 */
function removeTag(thisFile: TFile, tag:string){
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
	this.app.fileManager.processFrontMatter(thisFile, processor)
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
function getTagList(app: App, settings: QuickTaggerSettings, fileList:TFile[]){
	// TODO: add filtering to remove tags that are already on the active file?
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
		console.log(new_tags)
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