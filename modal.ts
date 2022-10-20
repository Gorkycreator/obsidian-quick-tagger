import { App, Notice, SuggestModal } from "obsidian";
import {removeTag, addTag} from "./utilities"

interface Tags {
    name: string;
    position: string;
}


var tag_dict = app.metadataCache.getTags()
var tag_array = []

for (const key in tag_dict) {
    if (tag_dict.hasOwnProperty(key)) {
        tag_array.push({'name': key, 'position': tag_dict[key]})
    }
}

const ALL_TAGS = tag_array

const MODE_SWITCHER = {
    'add': addTag,
    'remove': removeTag
}

export class QuickTagSelector extends SuggestModal<Tags> {
    mode: number
    func: Function

    constructor (app: App, mode: string){
        super(app)
        this.func = MODE_SWITCHER[mode]
    }

    // Returns all availalbe suggestions
    getSuggestions(query: string): Tags[] {
        console.log(ALL_TAGS)
        return ALL_TAGS.filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()))
    }

    // Renders each suggestion item
    renderSuggestion(tag: Tags, el: HTMLElement) {
        el.createEl('div', {text: tag.name});
    }

    // Perform action on the selected suggestion
    onChooseSuggestion(tag: Tags, evt: MouseEvent | KeyboardEvent) {
        this.func(tag.name)
    }
}