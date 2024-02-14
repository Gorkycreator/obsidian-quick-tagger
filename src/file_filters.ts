// this file holds functions to filter the files based on tag and other criteria
import { TFile, parseFrontMatterTags } from "obsidian"
export { getFilteredWithTags, getFilteredWithoutTags, filterTags, onlyTaggableFiles }
import { SPECIAL_COMMANDS } from "./constants"


/** Filters array of files to only those that DO have at least one of the given tags
 * 
 * @param fileList 
 * @param tag 
 * @returns 
 */
function getFilteredWithTags(fileList:TFile[], tags:string[]){
    // early exit if the "tag" is a special command.
	if (SPECIAL_COMMANDS.includes(tags[0])){ return fileList }

	let resultList = fileList.filter(file => {return filterTags(file, tags) == true})
	return resultList
}


/** Filters array of files to only those that DO NOT have the given tag
 * 
 * @param fileList 
 * @param tag 
 * @returns TFile[]
 */
function getFilteredWithoutTags(fileList:TFile[], tags:string[]){
    // early exit if the "tag" is a special command.
	if (SPECIAL_COMMANDS.includes(tags[0])){ return fileList }

	console.log(fileList) // TODO: remove debug
	console.log(filterTags(fileList[0], tags)) // TODO: remove debug
	fileList.filter((file) => {return filterTags(file, tags) == false})
	console.log(fileList) // TODO: remove debug
	
	return fileList
}


/** Get note cache and return true if it includes all of the given tags
 * 
 * @param thisFile 
 * @param tag 
 * @returns 
 */
function filterTags(thisFile: TFile, tags: string[]){
	let cache = this.app.metadataCache.getFileCache(thisFile)
	let existing_tags = parseFrontMatterTags(cache.frontmatter)
	if (existing_tags?.filter((tag) => {return tags.includes(tag)})){
		return true
	} else {
		return false
	}
}


/** Filter out folders and non markdown files
 * 
 * @param fileList 
 * @returns 
 */
function onlyTaggableFiles(fileList: TFile[]){
	let resultList = fileList.filter(file => (file.extension ? true : false) == true && file.extension == "md")
	return resultList
}