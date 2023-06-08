import { App, FuzzySuggestModal, Modal, Setting, Notice, TFile } from "obsidian";
import {addTagToMany, getTagList, getTagsOnFiles, removeTagFromMany} from "./utilities"
import {QuickTaggerSettings} from "./main"


type modeSwitcherLayout = {
    add: Function;
    remove?: Function;
}

const MODE_SWITCHER: modeSwitcherLayout = {
    'add': addTagToMany,
    'remove': removeTagFromMany
}


type tagGathererLayout = {
    add: Function;
    remove?: Function;
}

const TAG_GATHERER: tagGathererLayout = {
    'add': getTagList,
    'remove': getTagsOnFiles
}


export class QuickTagSelector extends FuzzySuggestModal<string> {
    mode: string
    func: Function | undefined
    tagArray: Function | undefined
    confirm: boolean
    settings: QuickTaggerSettings
    fileList: TFile[]

    
    constructor (app: App, settings: QuickTaggerSettings, fileList: Array<TFile>, mode: string){
        super(app)
        this.func = MODE_SWITCHER[mode as keyof modeSwitcherLayout]
        this.tagArray = TAG_GATHERER[mode as keyof tagGathererLayout]
        this.settings = settings
        this.fileList = fileList
    }

    getItems() {
        if(!this.tagArray){
            new Notice("Error: Could not find tags!")
            return []
        }
        var results = this.tagArray(app, this.settings, this.fileList)
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
            this.func(this.fileList, tag.replace('#', ''))
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
        contentEl.createEl("h1", { text: "This will delete all tags on the current note(s), are you certain?" })
		
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