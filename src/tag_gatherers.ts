// This file holds functions used to populate the tag selector modal
import { QuickTaggerSettings, StarredTag } from "./main"
import { TFile, parseFrontMatterTags } from "obsidian"
export { getTagList, getTagsOnFiles, getNonStarredTags }

/** Build a list of tags starting with configured starred tags. Used for adding tags to notes.
 * If the option is set, add all tags in Obsidian to the list as
 * well.
 * 
 * @param settings 
 * @param fileList
 * @returns string[] of tags
 */
function getTagList(settings: QuickTaggerSettings, fileList?:TFile[]){
	// TODO: add filtering to remove tags that are already on the active file?
	let tagSettings = getStarredTags(settings, 'cut_in_line')
	let tag_array = tagSettings.map((e) => e.replace('#', ''))
	                           .filter((e) => e)
							   .map((e) => '#' + e)
	
	if (!settings.all_tags){
		return tag_array
	}
	
    let tag_cache = getTagsFromAppCache()
	tag_cache.sort()
	tag_cache.forEach(tag => {
		if (tag_array.indexOf(tag) == -1){
			tag_array.push(tag)
		}
	})
	return tag_array
}


/** Build a list of tags from the given files. Used for removing tags from notes.
 * 
 * @param settings 
 * @param fileList
 * @returns 
 */
function getTagsOnFiles(settings: QuickTaggerSettings, fileList:TFile[]){
	let tag_array = [] as string[]
	fileList.forEach((f) =>{
		let cache = this.app.metadataCache.getFileCache(f)
		let new_tags = parseFrontMatterTags(cache.frontmatter)
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


/** Used for selecting new starred tags.
 * Build a list of tags in Obsidian _excluding_ starred tags. 
 * 
 * @param settings
 * @param fileList 
 * @returns 
 */
function getNonStarredTags(settings: QuickTaggerSettings, fileList?:TFile[]){
	let tag_array = getTagsFromAppCache()
	let starredTags = getStarredTags(settings)
	starredTags.forEach(t => tag_array.remove(t))
	tag_array.sort()
	return tag_array
}


/** Build a list of starred tags from the plugin settings
 * 
 * @param settings 
 * @param filter a key of the StarredTag settings to filter only priority tags that are enabled.
 * @returns 
 */
function getStarredTags(settings: QuickTaggerSettings, filter_key?:string){
	let results = [] as string[]
	settings.priorityTags.forEach((t) => {
        if(filter_key){
            // if the settings are not enabled for 'filter_key', skip adding tag to result list
            t[filter_key as keyof StarredTag] ? results.push(t.tag_value) : null
        } else {
            results.push(t.tag_value)
        }
    })
	return results
}


/** Conveninece function to convert the metadata cache to a list of strings
 * 
 * @returns string[] of tags
 */
function getTagsFromAppCache(){
	let results = [] as string[]
	for (const key in this.app.metadataCache.getTags()){
		results.push(key)
	}
	return results
}