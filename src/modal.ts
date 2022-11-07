import { App, FuzzySuggestModal, Modal, Setting } from "obsidian";
import {removeTag, addTag, getTagList, getExistingTags} from "./utilities"
import {QuickTaggerSettings} from "./main"

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
    confirm: boolean

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
    async onChooseItem(tag: string, evt: MouseEvent | KeyboardEvent) {
        if (tag == "REMOVE ALL"){
            this.confirm = await new Promise((resolve, reject) => {  // add a promise to wait for confirmation
                new ConfirmRemoveAllModal(app, (result) => (resolve(this.confirm = result))).open()
            })
        } else {
            this.confirm = true
        }
        if (this.confirm){
            this.func(tag)
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