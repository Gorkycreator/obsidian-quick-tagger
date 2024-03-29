import { App, FuzzySuggestModal, Modal, Setting, Notice, TFile, renderResults, prepareFuzzySearch, FuzzyMatch, fuzzySearch, prepareQuery } from "obsidian";
import QuickTagPlugin, {QuickTaggerSettings} from "./main"
import { SPECIAL_COMMANDS } from "./constants"
import { prep_clean_query } from "clean_inputs";
import { TagGatherer } from "tag_gatherers";
export { ConfirmModal, QuickTagSelector }


/** This modal class handles selecting a tag and should pass a tag back to the main function.
 * 
 */
class QuickTagSelector extends FuzzySuggestModal<string> {
    plugin: QuickTagPlugin
    onChooseItemCallback: (result: string) => void
    gatherer: Function
    settings: QuickTaggerSettings
    fileList: TFile[]
    tag: string
    inputListener: EventListener
    tagCache: string[]
    new_tags_enabled: boolean

    
    constructor (plugin: QuickTagPlugin, gatherer: TagGatherer, onChooseItemCallback: (result: string) => void, fileList?: Array<TFile>){
        super(plugin.app)
        this.plugin = plugin
        this.gatherer = gatherer.retrieve_tags
        this.settings = plugin.settings
        this.fileList = fileList ? fileList : []
        this.tag = ''
        this.onChooseItemCallback = onChooseItemCallback
        this.inputListener = this.listenInput.bind(this)
        this.tagCache = []
        this.new_tags_enabled = gatherer.get_new_tag_permission()
    }

    onOpen() {
        this.setPlaceholder("Select a tag")
        this.inputEl.addEventListener('keyup', this.inputListener)
        super.onOpen()
    }

    onClose() {
        this.inputEl.removeEventListener('keyup', this.inputListener)
        super.onClose()
    }

    listenInput(evt: KeyboardEvent){
        this.getSuggestions(this.inputEl.value)
    }

    override getSuggestions(query: string): FuzzyMatch<string>[] {
        let cleaned_query = prep_clean_query(query, this.plugin)  // TODO: make the settings determine this

        let search = prepareFuzzySearch(cleaned_query)
        
        let options = this.getItems()
        if(this.new_tags_enabled) {
            if (!/^[0-9]+$/.test(cleaned_query)){  // pure numeric entries are not valid tags
                options = options.concat(["#" + cleaned_query + " (new tag)"])
            }
        }
        
        let result: FuzzyMatch<string>[] = []

        for (const item in options){
            const match = search(options[item])
            if (match){
                result.push({'item': options[item], 'match': match})
            }
        }

        return result
    }

    getItems(): string[] {
        if(!this.gatherer){
            new Notice("Error: Could not find tags!")
            return []
        }

        if(this.tagCache.length == 0){
            this.tagCache = this.gatherer(this, this.fileList)
        }
        
        return this.tagCache
    }

    getItemText(tag: string): string {
        return tag
    }

    async onChooseItem(result: string) {
        let cleaned_tag = SPECIAL_COMMANDS.includes(result) ? result : result.split(' ')[0]
        this.onChooseItemCallback(cleaned_tag)
    }
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
