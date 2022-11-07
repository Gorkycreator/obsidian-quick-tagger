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
	// sets up the yaml header with a given key
	if (/^\n*\-\-\-/.test(note_content)){  // add to yaml if it exists
		note_content = yamlEditor(note_content, (yml: object) => {
			for(var i=0; i<required_fields.length; i++){
				if (!yml.hasOwnProperty(required_fields[i])){yml[required_fields[i]] = []}
			}
			return yml
		})
		return note_content
	} else {  // build yaml if it does not exist
		var yml_header = "---\n"
		for(var i=0; i<required_fields.length; i++){
			yml_header = yml_header + required_fields[i] + ": \n"
		}
		yml_header = yml_header + "---\n"
		note_content = yml_header + note_content
		return note_content
	}
}

function ensureTagsArray(note_content: string){
  // preps yaml with the 'tags' array, absorbing any existing 'tag' or 'tags' key
  var updated_content = prepYaml(note_content, ['tags'])
  updated_content = yamlEditor(updated_content, (yml: object) => {
    if (!yml.tag){return yml}  // if no 'tag' key, it's good to go
    var plural = yamlToArray(yml.tags)
    var singular = yamlToArray(yml.tag)
    for(var i=0;i<singular.length;i++){  // add all tags from 'tag' to 'tags'
      if (plural.indexOf(singular[i]) == -1){
			plural.push(singular[i])
      }
    }
    yml.tags = plural
    delete yml.tag
    return yml
  })
  return updated_content
}

function yamlToArray(content: string|Array<string>){
	// converts a yaml string to an array or logs an error if the type is unknown
	if (typeof(content) == 'string'){
		var tags = content.split(",")
		tags = tags.map(s => s.trim())
		return tags
	} else if (typeof(content) == 'object' && content !== null){
		return content
	} else {
		console.log("ERROR: yaml 'tags' value is not string or array!")
		return []
	}
}

function addTag(new_tag: string){
	// Add a tag to the yaml header
    editTag(new_tag, (yml: object) => {
		yml.tags = yamlToArray(yml.tags)
		var clean_tag = new_tag.replace("#", "")
		if (yml.tags.includes(clean_tag) == false){
			yml.tags.push(clean_tag)
		} else {
			new Notice('Already tagged with "' + new_tag + '"')
		}
		return yml
	})
}

function editTag(tag: string, operation: Function){
	// access the markdownView and apply an operation to the yaml's tags attribute
    const markdownView = markdownViewCheck(app)
    if (!markdownView){return}

    var note_content = markdownView.editor.getValue()
	note_content = ensureTagsArray(note_content)  // make sure there's a yaml header with tags
	note_content = yamlEditor(note_content, operation)
	markdownView.setViewData(note_content, false)
	markdownView.editor.setValue(note_content)
}

function removeTag(tag: string){
	// remove a tag from the yaml header
	editTag(tag, (yml: object) => {
		yml.tags = yamlToArray(yml.tags)
		if (tag == "REMOVE ALL"){  // TODO: add confirmation dialog for this one...
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
}

function getTagList(app: App, settings: QuickTaggerSettings){
	var tagSettings = yamlToArray(settings.tags)
	var tag_array = []

	for (var i=0; i<tagSettings.length; i++){
		var name = tagSettings[i].replace('#', '')
		if(name){tag_array.push("#" + name)}
	}
	
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

export function getExistingTags(app: App, settings: QuickTaggerSettings){
	// TODO: this can be updated to work with category tags (user creates template note with categores
	//       and this gets existing tags on that note?)
	const markdownView = markdownViewCheck(app)
  if (!markdownView){return}

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

function markdownViewCheck (app: App){
	const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
	if (!markdownView){
		new Notice("No file open!")
	}
	return markdownView
}