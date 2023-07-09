// this file holds functions to filter the files based on tag and other criteria
import { TFile, parseFrontMatterTags } from "obsidian"
export { getFilteredWithTag, getFilteredWithoutTag, filterTag, onlyTaggableFiles }


const SPECIAL_COMMANDS = ['REMOVE ALL']


/** Filters array of files to only those that DO have the given tag
 * 
 * @param fileList 
 * @param tag 
 * @returns 
 */
function getFilteredWithTag(fileList:TFile[], tag:string){
    // early exit if the "tag" is a special command.
	if (SPECIAL_COMMANDS.includes(tag)){ return fileList }

	var resultList = fileList.filter(file => filterTag(file, tag) == true)
	return resultList
}


/** Filters array of files to only those that DO NOT have the given tag
 * 
 * @param fileList 
 * @param tag 
 * @returns TFile[]
 */
function getFilteredWithoutTag(fileList:TFile[], tag:string){
    // early exit if the "tag" is a special command.
	if (SPECIAL_COMMANDS.includes(tag)){ return fileList }

	var resultList = fileList.filter(file => filterTag(file, tag) == false)
	return resultList
}


/** Get note cache and return true/false if it includes given tag
 * 
 * @param thisFile 
 * @param tag 
 * @returns 
 */
function filterTag(thisFile: TFile, tag: string){
	var cache = this.app.metadataCache.getFileCache(thisFile)
	var existing_tags = parseFrontMatterTags(cache.frontmatter)
	if (existing_tags?.includes(tag)){
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
	var resultList = fileList.filter(file => (file.extension ? true : false) == true && file.extension == "md")
	return resultList
}