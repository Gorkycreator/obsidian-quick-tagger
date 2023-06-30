import { App, FuzzySuggestModal, Modal, Setting, Notice, TFile, Plugin } from "obsidian";
import {addTagToMany, getTagList, getTagsOnFiles, removeTagFromMany, getFilteredWithoutTag, getFilteredWithTag, getNonStarredTags} from "./utilities"
import QuickTagPlugin, {QuickTaggerSettings} from "./main"
import { PassThrough } from "stream";
export {QuickTagSelector, ConfirmModal, JustTagSelector}


type modeSwitcherLayout = {
    add: Function;
    remove: Function;
    select: Function;
}

const MODE_SWITCHER: modeSwitcherLayout = {
    'add': addTagToMany,
    'remove': removeTagFromMany,
    'select': () => {}
}


const TAG_GATHERER: modeSwitcherLayout = {
    'add': getTagList,
    'remove': getTagsOnFiles,
    'select': getNonStarredTags
}


const FILE_FILTER_BY_TAG: modeSwitcherLayout = {
    'add': getFilteredWithoutTag,
    'remove': getFilteredWithTag,
    'select': () => {}
}



class QuickTagSelector extends FuzzySuggestModal<string> {
    plugin: Plugin
    mode: string
    func: Function
    tagArray: Function
    confirm: boolean
    settings: QuickTaggerSettings
    fileList: TFile[]
    fileFilter: Function
    showDialogs: Function
    applicableFiles: TFile[]
    tag: string

    
    constructor (plugin: QuickTagPlugin, fileList: Array<TFile>, mode: string){
        super(plugin.app)
        this.plugin = plugin
        this.func = MODE_SWITCHER[mode as keyof modeSwitcherLayout]
        this.tagArray = TAG_GATHERER[mode as keyof modeSwitcherLayout]
        this.fileFilter = FILE_FILTER_BY_TAG[mode as keyof modeSwitcherLayout]
        this.settings = plugin.settings
        this.fileList = fileList
        this.mode = mode
        this.applicableFiles = []
        this.confirm = true
        this.tag = "hello"
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
        if (this.mode == 'select'){
            this.tag = tag
            this.close()
            return
        }

        this.applicableFiles = this.fileFilter(this.fileList, tag)

        if (this.applicableFiles.length == 0){
            new Notice("No file tags to change!")
            return
        }

        await this.addDialogs(tag)

        if (this.confirm && this.func){
            await this.func(this.applicableFiles, tag.replace('#', ''), this.plugin).then(
                () => this.confirmationNotification(tag)
            )
        }
    }


    async addDialogs(tag:string) {
        var verb = this.mode
        var tofrom = this.mode == 'add' ? " to " : " from "
        var quantity = this.applicableFiles.length

        if (tag == "REMOVE ALL"){
            var msg = "This will delete all tags on the current note(s), are you sure?"
            await new Promise((resolve) => {  // add a promise to wait for confirmation
                new ConfirmModal(app, (result) => (resolve(this.confirm = result)), msg).open()
            })
            verb = ""
        }
        if (quantity > 1){
            var msg = "You are about to " + 
                      verb + " " +
                      tag +
                      tofrom +
                      quantity + " notes, are you sure?"
            await new Promise((resolve) => {  // add a promise to wait for confirmation
                new ConfirmModal(app, (result) => (resolve(this.confirm = result)), msg).open()
            })
        }
        return this.confirm
    }

    confirmationNotification(tag:string){
        var notes = this.applicableFiles.length > 1 ? this.applicableFiles.length + " notes" : this.applicableFiles[0].basename
        var tofrom = this.mode == 'add' ? " added to " : " removed from "
        if (tag == "REMOVE ALL"){
            new Notice("All tags removed from " + notes)
        } else {
            new Notice(tag + tofrom + notes)
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