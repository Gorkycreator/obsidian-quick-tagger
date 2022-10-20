import{parseYaml, stringifyYaml, MarkdownView, Notice} from 'obsidian'
export {prepYaml, addTag, removeTag}

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

	tag = tag.replace("#", '')  // make sure we didn't get any hashtags with that tag selection!

    var note_content = markdownView.getViewData()
	note_content = yamlEditor(note_content, (yml: object) => {
		yml.tags = yamlToArray(yml.tags)
		if (yml.tags.includes(tag) == false){yml.tags.push(tag)}
		return yml
	})
	markdownView.setViewData(note_content)
}


function removeTag(tag: string){
	const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView){
        new Notice("No File open!")
        return
    }

	tag = tag.replace("#", '')  // make sure we didn't get any hashtags with that tag selection!

	var note_content = markdownView.getViewData()
	note_content = yamlEditor(note_content, (yml: object) => {
		yml.tags = yamlToArray(yml.tags)
		var index = yml.tags.indexOf(tag)
		while (index > -1){
			yml.tags.splice(index, 1)
			index = yml.tags.indexOf(tag)
		}
		return yml
	})
	markdownView.setViewData(note_content)
}