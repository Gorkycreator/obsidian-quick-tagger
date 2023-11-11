// This file holds functions used to populate the tag selector modal
import QuickTagPlugin, { QuickTaggerSettings, StarredTag } from "./main"
import { TFile, parseFrontMatterTags } from "obsidian"
export { AddTagList, TagsOnFiles, NonStarredTags, BaseGatherer }



export interface TagGatherer {
	retrieve_tags: (plugin: QuickTagPlugin, fileList?:TFile[], filter_key?:string) => string[]
	get_new_tag_permission: () => boolean
}


class BaseGatherer {
	_new_tag_permission = true;

	enable_new_tag_permission(){
		this._new_tag_permission = true
	}

	disable_new_tag_permission(){
		this._new_tag_permission = false
	}

	get_new_tag_permission(){
		return this._new_tag_permission
	}
}


/** Build a list of tags starting with configured starred tags. Used for adding tags to notes.
 * If the option is set, add all tags in Obsidian to the list as well.
 */
class AddTagList extends BaseGatherer implements TagGatherer {
	retrieve_tags(plugin:QuickTagPlugin, fileList?:TFile[]) {
		let tagSettings = _getStarredTags(plugin.settings, 'cut_in_line')
		let tag_array = tagSettings.map((e) => e.replace('#', ''))
								.filter((e) => e)
								.map((e) => '#' + e)
		
		if (!plugin.settings.all_tags){
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
}


/** Build a list of tags from the given files. Used for removing tags from notes.
 * 
 */
class TagsOnFiles extends BaseGatherer implements TagGatherer {
	_new_tag_permission = false
	tag_map: {[key: string]: number}
	retrieve_tags(plugin: QuickTagPlugin, fileList:TFile[]){
		let tag_array = [] as string[]
		this.tag_map = {}
		fileList.forEach((f) =>{
			let cache = plugin.app.metadataCache.getFileCache(f)
			if (cache){
				let new_tags = parseFrontMatterTags(cache.frontmatter)
				if(new_tags){
					new_tags.map((e) => e.replace('#', '')).filter((e) => e).map((e) => '#' + e)
					new_tags.forEach((item) =>{
						if(!(item in this.tag_map)){
							this.tag_map[item] = 0
						}
						this.tag_map[item] += 1
						// !tag_array.includes(item) ? tag_array.push(item) : undefined
					})
				}
			}
		})
		
		for(const item in this.tag_map){
			let quantity = this.tag_map[item]
			if (quantity > 1){
				tag_array.push(item + " (" + this.tag_map[item].toString() + " notes)")
			} else {
				tag_array.push(item)
			}
			
		}

		tag_array.push('REMOVE ALL')
		return tag_array
	}
}

/** Used for selecting new starred tags.
 * Build a list of tags in Obsidian _excluding_ starred tags. 
 */
class NonStarredTags extends BaseGatherer implements TagGatherer {
	_new_tag_permission = false
	retrieve_tags(plugin: QuickTagPlugin){
		let tag_array = getTagsFromAppCache()
		let starredTags = _getStarredTags(plugin.settings)
		starredTags.forEach(t => tag_array.remove(t))
		tag_array.sort()
		return tag_array
	}
}


/** Build a list of starred tags from the plugin settings
 * 
 * @param settings 
 * @param filter a key of the StarredTag settings to filter only priority tags that are enabled.
 * @returns 
 */
function _getStarredTags(settings: QuickTaggerSettings, filter_key?:string){
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