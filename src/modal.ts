import { App, FuzzySuggestModal, Modal, Setting, Notice } from "obsidian";
import {addTagToActive, getTagList, getTagsOnActive, removeTagFromActive} from "./utilities"
import {QuickTaggerSettings} from "./main"


type modeSwitcherLayout = {
    add: Function;
    remove?: Function;
}

const MODE_SWITCHER: modeSwitcherLayout = {
    'add': addTagToActive,
    'remove': removeTagFromActive
}


type tagGathererLayout = {
    add: Function;
    remove?: Function;
}

const TAG_GATHERER: tagGathererLayout = {
    'add': getTagList,
    'remove': getTagsOnActive
}


export class QuickTagSelector extends FuzzySuggestModal<string> {
    mode: string
    func: Function | undefined
    tagArray: Function | undefined
    confirm: boolean
    settings: QuickTaggerSettings

    
    constructor (app: App, settings: QuickTaggerSettings, mode: string){
        super(app)
        this.func = MODE_SWITCHER[mode as keyof modeSwitcherLayout]
        this.tagArray = TAG_GATHERER[mode as keyof tagGathererLayout]
        this.settings = settings
    }

    getItems() {
        if(!this.tagArray){
            new Notice("Error: Could not find tags!")
            return []
        }
        var results = this.tagArray(app, this.settings)
        return results
    }

    getItemText(tag: string): string {
        return tag
    }

    // Perform action on the selected suggestion
    async onChooseItem(tag: string, evt: MouseEvent | KeyboardEvent) {
        if (tag == "REMOVE ALL"){
            this.confirm = await new Promise((resolve, reject) => {  // add a promise to wait for confirmation
                new ConfirmRemoveAllModal(app, (result) => (resolve(this.confirm = result))).open()
            })
        } else {
            this.confirm = true
        }
        if (this.confirm && this.func){
            this.func(tag.replace('#', ''))
        }
    }
}


class ConfirmRemoveAllModal extends Modal {
    onSubmit: (result: boolean) => void;

	constructor(app: App, onSubmit: (result: boolean) => void) {
		super(app);
        this.onSubmit = onSubmit
	}

	onOpen() {
		const { contentEl } = this;
        contentEl.createEl("h1", { text: "This will delete all tags on the current note, are you certain?" })
		
        new Setting(contentEl).addButton((btn) =>
          btn
            .setButtonText("Yes")
            .setCta()
            .onClick(() => {
                this.close()
                this.onSubmit(true)
            }))
        .addButton((btn) =>
          btn
            .setButtonText("No")
            .setCta()
            .onClick(() => {
                this.close()
                this.onSubmit(false)
            }))
	}

	async onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}

}