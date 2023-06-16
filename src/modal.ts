import { App, FuzzySuggestModal, Modal, Setting, Notice, TFile } from "obsidian";
import {addTagToMany, getTagList, getTagsOnFiles, removeTagFromMany, getFilteredWithoutTag, getFilteredWithTag} from "./utilities"
import {QuickTaggerSettings} from "./main"
export {QuickTagSelector, ConfirmModal}


type modeSwitcherLayout = {
    add: Function;
    remove: Function;
}

const MODE_SWITCHER: modeSwitcherLayout = {
    'add': addTagToMany,
    'remove': removeTagFromMany
}


const TAG_GATHERER: modeSwitcherLayout = {
    'add': getTagList,
    'remove': getTagsOnFiles
}


const TAG_FILTER: modeSwitcherLayout = {
    'add': getFilteredWithoutTag,
    'remove': getFilteredWithTag
}


class QuickTagSelector extends FuzzySuggestModal<string> {
    mode: string
    func: Function
    tagArray: Function
    confirm: boolean
    settings: QuickTaggerSettings
    fileList: TFile[]
    fileFilter: Function

    
    constructor (app: App, settings: QuickTaggerSettings, fileList: Array<TFile>, mode: string){
        super(app)
        this.func = MODE_SWITCHER[mode as keyof modeSwitcherLayout]
        this.tagArray = TAG_GATHERER[mode as keyof modeSwitcherLayout]
        this.fileFilter = TAG_FILTER[mode as keyof modeSwitcherLayout]
        this.settings = settings
        this.fileList = fileList
        this.mode = mode
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
        this.confirm = true
        var applicableFiles = this.fileFilter(this.fileList, tag)
        var mode = this.mode

        if (applicableFiles.length == 0){
            new Notice("No file tags to change!")
            return
        }

        if (tag == "REMOVE ALL"){
            var msg = "This will delete all tags on the current note(s), are you certain?"
            await new Promise((resolve) => {  // add a promise to wait for confirmation
                new ConfirmModal(app, (result) => (resolve(this.confirm = result)), msg).open()
            })
            mode = ""
        }
        if (this.fileList.length > 1){
            var msg = "You are about to " + mode + " " + tag + " (" + applicableFiles.length + " notes), are you certain?"
            await new Promise((resolve) => {  // add a promise to wait for confirmation
                new ConfirmModal(app, (result) => (resolve(this.confirm = result)), msg).open()
            })
        }
        if (this.confirm && this.func){
            this.func(applicableFiles, tag.replace('#', ''))
        }
    }
}


class ConfirmModal extends Modal {
    onSubmit: (result: boolean) => void;
    message: string

	constructor(app: App, onSubmit: (result: boolean) => void, message: string) {
		super(app);
        this.onSubmit = onSubmit
        this.message = message
	}

	onOpen() {
		const { contentEl } = this;
        contentEl.createEl("h1", { text: this.message })
		
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