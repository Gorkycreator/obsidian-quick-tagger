import { App, FuzzySuggestModal, Modal, Setting, Notice, TFile } from "obsidian";
import QuickTagPlugin, {QuickTaggerSettings} from "./main"
export { ConfirmModal, QuickTagSelector }


/** This modal class handles selecting a tag and should pass a tag back to the main function.
 * 
 */
class QuickTagSelector extends FuzzySuggestModal<string> {
    onChooseItem: (result: string) => void
    gatherer: Function
    settings: QuickTaggerSettings
    fileList: TFile[]
    tag: string

    
    constructor (plugin: QuickTagPlugin, gatherer: Function, fileList: Array<TFile>, onChooseItem: (result: boolean) => void){
        super(plugin.app)
        this.gatherer = gatherer
        this.settings = plugin.settings
        this.fileList = fileList
        this.tag = ''
    }

    getItems(): string[] {
        if(!this.gatherer){
            new Notice("Error: Could not find tags!")
            return []
        } 

        let results = this.gatherer(this.settings, this.fileList)
        return results
    }

    getItemText(tag: string): string {
        return tag
    }

    // this should be overwritten when called to hook into a promise's resolve
    // async onChooseItem(tag: string) {
    //     this.tag = tag
    // }
}


class ConfirmModal extends Modal {
    onSubmit: (result: boolean) => void;
    message: string

	constructor(thisApp: App, onSubmit: (result: boolean) => void, message: string) {
		super(thisApp);
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