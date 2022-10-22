import{parseYaml, stringifyYaml, MarkdownView, Notice, getAllTags, App, Plugin} from 'obsidian'
import {QuickTaggerSettings} from "./main"
export {prepYaml, addTag, removeTag, getTagList}

function yamlEditor(note_content: string, yaml_exec: Function) {
	// first split the yaml out
	var ary = note_content.split("---")
	var yml = parseYaml(ary[1])
	if (yml == null){yml = {}}

	// do the function
	yml = yaml_exec(yml)
	
	// piece things back together
	ary[1] = "\n"+stringifyYaml(yml)
	return ary.join("---")
}


function prepYaml(note_content: string, required_fields: Array<string>){
	if (/^\n*\-\-\-/.test(note_content)){
		console.log("there is yaml")
		note_content = yamlEditor(note_content, (yml: object) => {
			for(var i=0; i<required_fields.length; i++){
				if (!yml.hasOwnProperty(required_fields[i])){yml[required_fields[i]] = []}
			}
			return yml
		})
		return note_content
	} else {
		console.log("there is no yaml")  // build yaml if it doesn't exist
		note_content = "---\ntags: \n---\n" + note_content
		return note_content
	}
}


function yamlToArray(content: string|Array<string>){
	if (typeof(content) == 'string'){
		console.log("it's a string")
		var tags = content.split(",")
		tags = tags.map(s => s.trim())
		return tags
	} else if (typeof(content) == 'object' && content !== null){
		console.log("it's an array")
		console.log(typeof(content))
		return content
	} else {
		console.log("what is it?")
		return []
	}
}


function addTag(tag: string){
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView){
        new Notice("No File open!")
        return
    }

	var new_tag = tag.replace("#", '')  // make sure we didn't get any hashtags with that tag selection!

    var note_content = markdownView.editor.getValue()
	note_content = yamlEditor(note_content, (yml: object) => {
		yml.tags = yamlToArray(yml.tags)
		if (yml.tags.includes(new_tag) == false){
			yml.tags.push(new_tag)
		} else {
			new Notice('Already tagged with "' + tag + '"')
		}
		return yml
	})
	markdownView.setViewData(note_content)
	markdownView.editor.setValue(note_content)
}


function removeTag(tag: string){
	const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView){
        new Notice("No File open!")
        return
    }

	tag = tag.replace("#", '')  // make sure we didn't get any hashtags with that tag selection!

	var note_content = markdownView.editor.getValue()
	note_content = yamlEditor(note_content, (yml: object) => {
		yml.tags = yamlToArray(yml.tags)
		if (tag == "REMOVE ALL"){  // add confirmation dialog for this one...
			yml.tags = []
			return yml
		}
		var index = yml.tags.indexOf(tag)
		while (index > -1){
			yml.tags.splice(index, 1)
			index = yml.tags.indexOf(tag)
		}
		return yml
	})
	markdownView.setViewData(note_content)
	markdownView.editor.setValue(note_content)
}

function getTagList(app: App, settings: QuickTaggerSettings){
	var tagSettings = yamlToArray(settings.tags)
	console.log(tagSettings)
	var tag_dict = app.metadataCache.getTags()
	var tag_array = []

	for (var i=0; i<tagSettings.length; i++){
		var name = "#" + tagSettings[i].replace('#', '')
		tag_array.push(name)
	}

	if (!settings.all_tags){
		return tag_array
	}

	for (const key in tag_dict) {
		if (tag_dict.hasOwnProperty(key)) {
			if (tag_array.indexOf(key) == -1){
				tag_array.push(key)
			}
		}
	}
	return tag_array
}

export function getExistingTags(app: App, settings: QuickTaggerSettings){
	// TODO: this can be updated to work with category tags (user creates template note with categores
	//       and this gets existing tags on that note?)
	const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView){
        new Notice("No File open!")
        return
    }

	var note_content = markdownView.getViewData()
	note_content = prepYaml(note_content, ['tags'])
	var ary = note_content.split("---")
	var yml = parseYaml(ary[1])
	yml.tags = yamlToArray(yml.tags)
	var tag_array = []

	for (var i=0; i<yml.tags.length; i++) {
		tag_array.push(yml.tags[i])
	}
	tag_array.push('REMOVE ALL')
	return tag_array
}