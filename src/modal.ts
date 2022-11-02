import { App, FuzzySuggestModal, Plugin, Setting } from "obsidian";
import {removeTag, addTag, getTagList, getExistingTags} from "./utilities"
import {QuickTaggerSettings} from "../main"

const MODE_SWITCHER = {
    'add': addTag,
    'remove': removeTag
}

const TAG_GATHERER = {
    'add': getTagList,
    'remove': getExistingTags
}

export class QuickTagSelector extends FuzzySuggestModal<string> {
    mode: number
    func: Function
    tagArray: Array<string>

    constructor (app: App, settings: QuickTaggerSettings, mode: string){
        super(app)
        this.func = MODE_SWITCHER[mode]
        this.tagArray = TAG_GATHERER[mode](app, settings)
    }

    getItems() {
        return this.tagArray
    }
    getItemText(tag: string): string {
        return tag
    }

    // Perform action on the selected suggestion
    onChooseItem(tag: string, evt: MouseEvent | KeyboardEvent) {
        this.func(tag)
    }
}