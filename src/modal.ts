import { App, FuzzySuggestModal, Modal, Setting, Notice, TFile, renderResults, prepareFuzzySearch, FuzzyMatch, fuzzySearch, prepareQuery, setIcon, Scope, Plugin, KeymapContext, KeymapEventHandler, KeymapEventListener, getAllTags } from "obsidian";
import QuickTagPlugin, {QuickTaggerSettings} from "./main"
import { SPECIAL_COMMANDS } from "./constants"
import { prep_clean_query } from "clean_inputs";
import { NonStashedTags, RecursiveTagLoop, TagGatherer } from "tag_gatherers";
import { modal_selection_is_special, parseModalTags, selectManyTags } from "utilities";
export { ConfirmModal, QuickTagSelector, QuickTagSelectorLoop, MultiTagSelectModal }


/** This modal class handles selecting a tag and should pass a tag back to the main function.
 * 
 */
class QuickTagSelector extends FuzzySuggestModal<string> {
    plugin: QuickTagPlugin
    onChooseItemCallback: (result: string | string[]) => string | string[] | void
    gatherer: Function
    settings: QuickTaggerSettings
    fileList: TFile[]
    tag: string
    inputListener: EventListener
    tagCache: string[]
    new_tags_enabled: boolean
    message_box: HTMLHeadElement

    
    constructor (plugin: QuickTagPlugin, gatherer: TagGatherer, onChooseItemCallback: (result: string | string[]) => string | void, fileList?: Array<TFile>){
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
        this.setPlaceholder("Select a tag (hit ESC to cancel)")
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
        let cleaned_query = prep_clean_query(query, this.plugin)

        let search = prepareFuzzySearch(cleaned_query)
        
        let options = this.getItems()
        let cleaned_options: string[] = []
        options.forEach((opt) => cleaned_options.push(opt.toLowerCase().replace("#", '')))  // make matches case insensitive
        
        let result: FuzzyMatch<string>[] = []

        for (const indx in options){
            const match = search(options[indx])
            if (match){
                
                result.push({'item': options[indx], 'match': match})
            }
        }
        
        result.sort((a: FuzzyMatch<string>, b: FuzzyMatch<string>) => b.match.score - a.match.score)
        
        // New entry is added last so that it is not sorted.
        if(this.new_tags_enabled && !cleaned_options.includes(cleaned_query.toLowerCase())) {
            const match = search(cleaned_query)  // this isn't really needed, just make it so TypeScript doesn't get mad at us.
            if (!/^[0-9]+$/.test(cleaned_query) && !/^\/+$/.test(cleaned_query) && match) {  // pure numeric entries are not valid tags.
                result.push({'item': "#" + cleaned_query + " (new tag)", 'match': match})
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
            // only gather tags when this is initially created
            this.tagCache = this.gatherer(this.plugin, this.fileList)
        }
        
        return this.tagCache
    }

    getItemText(tag: string): string {
        return tag
    }

    async onChooseItem(result: string) {
        let cleaned_tag = modal_selection_is_special(result) ? result : result.split(' ')[0]
        this.onChooseItemCallback(cleaned_tag)
    }
}



class QuickTagSelectorLoop extends QuickTagSelector {
    tags: string[]
    recursive_gather: TagGatherer
    onChooseItemCallback: (result: string[]) => string[] | void;

    constructor (plugin: QuickTagPlugin, gatherer: TagGatherer, onChooseItemCallback: (result: string[]) => string[] | void, fileList?: Array<TFile>){
        super(plugin, gatherer, (result: string) => {}, fileList? fileList : new Array)
        this.recursive_gather = new RecursiveTagLoop(this, gatherer)
        this.gatherer = this.recursive_gather.retrieve_tags.bind(this.recursive_gather)
        this.onChooseItemCallback = onChooseItemCallback
        this.tags = new Array


        this.message_box = this.modalEl.createEl('h5', {text:'No tags selected'})
        this.message_box.addClass('quick-tagger-modal-message-box')
        this.message_box.setCssStyles({textAlign: "center", margin: "auto auto auto auto", padding: "0.5em 2em 0.5em 2em"})  // TODO: maybe this should go in a sytles.css?
        this.modalEl.insertAfter(this.message_box, null)
    }

    getItems(): string[] {
        if(!this.gatherer){
            new Notice("Error: Could not find tags!")
            return []
        }
        
        return this.gatherer(this.plugin, this.fileList)
    }

    async onChooseItem(result: string) {
        let cleaned_tag = modal_selection_is_special(result) ? result : result.split(' ')[0]
        if (cleaned_tag == "FINISHED SELECTING TAGS"){
            this.onChooseItemCallback(this.tags)
            return
        }
        let cleaned_tags = parseModalTags(cleaned_tag)
        cleaned_tags.forEach((t) => {
            if(!this.tags.contains(t)){
                this.tags.push(t)
            }
        })
        this.message_box.setText("Selected: " + this.tags.join(", "))
        selectManyTags(this.plugin, this)
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


class MultiTagSelectModal {
    // TODO: Add selector dropdown feature
    rootEl: HTMLElement
    inputEl: HTMLElement
    elements: HTMLElement[]
    values: string[]
    editing: boolean
    suggester: FloatingSuggester | null
    plugin: QuickTagPlugin
    

    constructor(parent: HTMLElement, plugin: QuickTagPlugin){
        this.editing = false
        this.plugin = plugin
        let this_selector = this
        this.rootEl = parent
                                  .createDiv({cls: 'metadata-property', attr:{
                                        'tabindex': 0,
                                        'data-property-key': 'tags',
                                        'data-property-type': 'multitext'
                                  }})
                                  .createDiv({cls: 'metadata-property-value'})
                                  .createDiv({cls: "multi-select-container"})
        this.inputEl = this._createInputEl()

        this.inputEl.addEventListener('keydown', (event) => {
            console.log(event)
            if (!event.isComposing){
                if ('Enter' === event.key && this.inputEl.getText().length > 0) {
                    event.preventDefault()
                    this.addElement(this.inputEl.getText())
                    this.inputEl.innerText = ''
                    this.inputEl.trigger('input')
                } 
                else if ('Enter' === event.key && this.inputEl.getText().length === 0){
                    // TODO: after implementing tag suggestor, reveiew whether this should be removed
                    event.preventDefault()
                    this.inputEl.innerText = ''
                    this.inputEl.focus()
                }
                else if ('Backspace' === event.key && 0 === this.inputEl.innerText.length && this.elements.length > 0) {
                    event.preventDefault()
                    let previous = this.elements[this.elements.length - 1]
                    if(previous){previous.focus()}
                }
                else if ('ArrowLeft' === event.key){
                    let active = this.inputEl.win.getSelection()
                    console.log(active)
                    if (0 === this.inputEl.getText().length && active && active.rangeCount > 0){
                        if (0 === active.getRangeAt(0).startOffset){
                            event.preventDefault()
                            this.focusElement(this.elements.length -1)
                        }
                    }
                }
            }
        })

        this.inputEl.addEventListener('blur', (event) => {
            let tmp_text = this.inputEl.getText()
            if (tmp_text) {
                this.addElement(tmp_text)
                this.inputEl.innerText = ''
                this.inputEl.trigger('input')
            }
            this.closeSuggester()
        })
        
        this.rootEl.addEventListener('click', (function(pointer_event) {
            if(pointer_event.targetNode === this_selector.rootEl){
                this_selector.inputEl.focus()
                this_selector.spawnSuggester()
            }
            
        }))

        this.elements = [],
        this.values = []

        this.renderValues()
    }

    _createElement(value: string){
        // this funciton handles whether an element _can_ be created, and then adds a pop-up warning that the tag is invalid
        
        // step 1 trim the tag
        // step 2 make sure the tag starts with #
        // step 3 make sure there are no invalid characters
        
        return prep_clean_query(value)
    }

    addElement(text: string, index: number | null = null) {
        // TODO: find and prevent duplicates
        if (index === null) {
            index = this.values.length
        }
        this.values[index] = text
        this.renderValues()
        this.update_hook()
    }

    _createInputEl(){
        let input = createDiv({
            cls: 'multi-select-input',
            attr: {
                contentEditable: !0,
                tabIndex: 0
            }
        })
        let this_selector = this
        input.addEventListener('input', (function(t){
            console.log(t)
            this_selector.closeSuggester()
        }))
        return input
    }

    focusElement(num:number){
        let index = Math.max(0, num)
        let element = this.elements[index]
        if(element){
            element.focus()
        } else {
            this.inputEl.focus()
        }
    }

    renderValues(){
        let this_selector = this
        this.elements = []  // empty the display
        for (let i = 0; i < this.values.length; i++){
            let this_tag = this.values[i]
            let pill = this.rootEl.createDiv({
                cls: 'multi-select-pill',
                attr: {
                    tabIndex: 0
                }
            })
            let value = pill.createDiv({
                cls: 'multi-select-pill-content'
            })
            let remove_button = pill.createDiv({
                cls: 'multi-select-pill-remove-button'
            })

            setIcon(remove_button, 'lucide-x')

            // omitting right-click menu for now. Edit by double-clicking works fairly well.
            // pill.addEventListener('contextmenu', bring_up_context_menu)

            pill.addEventListener('keydown', (event) => {
                if ('Enter' === event.key){
                    event.preventDefault()
                    this.editElement(i)
                }
                else if ('Backspace' === event.key) {
                    event.preventDefault()
                    this.removeElement(this_tag)
                    this.focusElement(i-1)
                }
                else if ('Delete' === event.key) {
                    event.preventDefault()
                    this.removeElement(this_tag)
                    this.focusElement(i)
                }
                else if ('ArrowUp' === event.key) {
                    event.preventDefault()
                    this.focusElement(0)
                }
                else if ('ArrowDown' === event.key) {
                    event.preventDefault()
                    this.inputEl.focus()
                }
                else if ('ArrowLeft' === event.key) {
                    event.preventDefault()
                    this.focusElement(i - 1)
                }
                else if ('ArrowRight' === event.key) {
                    event.preventDefault()
                    this.focusElement(i + 1)
                }
            })
            value.createSpan({text: String(this_tag)})
            value.addEventListener('dblclick', (e) => {e.preventDefault; this.editElement(i)})
            this.elements.push(pill)

            remove_button.addEventListener('mousedown', (e) => {return e.preventDefault()} )
            remove_button.addEventListener('click', (e) => {this.removeElement(this_tag); this.inputEl.trigger('input')})
        }
        this.rootEl.setChildrenInPlace(this.elements.concat([this.inputEl]))
        this.inputEl.setAttr('placeholder', this.elements.length > 0 ? "" : "None")
    }

    editElement(index: number){
        let this_element = this.elements[index]
        let old_text = this_element.getText()
        let edit_input = this._createInputEl()

        edit_input.addEventListener('keydown', (event) => {
            if ('Enter' === event.key && edit_input.getText().length > 0) {
                event.preventDefault()
                this.addElement(edit_input.getText(), index)
            }
            else if ('Escape' === event.key) {
                event.preventDefault()
                console.log(old_text)
                this.values[index] = old_text
                this.renderValues()
                this.focusElement(index)
            }
        })

        edit_input.addEventListener('focus', (event) => {this.editing = true})

        edit_input.addEventListener('blur', (event) => {
            if (this.editing){
                this.editing = false
                let tmp_text = edit_input.getText()
                if (tmp_text){
                    this.addElement(tmp_text, index)
                }
                else {
                    this.rootEl.insertBefore(this_element, edit_input)
                    edit_input.detach()
                }
            }
        })
        
        edit_input.innerText = String(this.values[index])
        
        this.rootEl.insertBefore(edit_input, this_element)
        this_element.detach()

        this.update_hook()

        // select the editable text automatically
        edit_input.focus()
        let n = edit_input.win
        let v = n.document.createRange()
        v.selectNodeContents(edit_input)
        var r = n.getSelection()
        if (r) {
            r.removeAllRanges()
            r.addRange(v)
        }
    }

    removeElement(text: string){
        this.values = this.values.filter((e) => {return e !== text})
        this.renderValues()
        this.update_hook()
    }

    get_tags() {
        return this.values
    }

    update_hook(){
        console.error("Quick Tagger: No update hook configured")
    }

    inject_new_data_hook(tags: string[]){
        this.values = tags
        this.renderValues()
    }

    spawnSuggester(){
        if (!this.suggester){
            this.suggester = new FloatingSuggester(null, this.inputEl, this.plugin)
        }
        this.suggester.open()
        this.populateSuggester()
    }

    populateSuggester(){
        let suggestions = new NonStashedTags().retrieve_tags(this.plugin)
        this.suggester?.suggestions.setSuggestions(suggestions)
    }
    closeSuggester(){
        if(this.suggester){
            this.suggester.close()
        }
    }
    
}


class FloatingSuggester {
    isOpen: boolean
    app: App
    scope: Scope
    suggestEl: HTMLElement
    suggestions: Suggester
    plugin: QuickTagPlugin
    parent: HTMLElement

    constructor(scope: Scope | null, parent: HTMLElement, plugin: QuickTagPlugin){
        let binding = this
        this.isOpen = false
        this.plugin = plugin
        this.scope = new Scope(scope || this.plugin.app.scope)
        this.parent = parent
        this.suggestEl = parent.createDiv('suggestion-container')
        let suggest_div = this.suggestEl.createDiv('suggestion')
        this.suggestions = new Suggester(this, suggest_div, this.scope)
        this.scope.register([], 'Escape', (function() {
            return binding.close()
        }))

        window.addEventListener('resize', this.autoReposition.bind(this))

        
        this.autoReposition()
    }

    open(){
        console.log("maybe I should open?")
        if (!this.isOpen){
            console.log('opening....')
            this.plugin.app.keymap.pushScope(this.scope)
            console.log(activeDocument)
            activeDocument.body.appendChild(this.suggestEl)
            this.isOpen = true
            // register pop-up for things like Android back button
            this.autoReposition()
        }
    }

    close(){
        if (this.isOpen){
            // if there is an autoDestroy function, run it and remove it
            this.plugin.app.keymap.popScope(this.scope)
            this.isOpen = false
            this.suggestions.setSuggestions([])
            this.suggestEl.detach()
            // unregister pop-up for things like Android back button
        }
    }

    autoReposition(){
        let bounding = this.parent.getBoundingClientRect()
        let x = bounding.left
        let y = bounding.bottom
        let max = this.plugin.app.workspace.containerEl.getBoundingClientRect().right
        let width = this.suggestEl.getBoundingClientRect().width
        console.log("sizes.........")
        console.log(width)
        console.log(x)
        console.log(max)
        if (x + width + 10 > max){
            console.log("bumping back onto screen")
            x = max - width - 10
        }
        console.log(x, y)
        this.suggestEl.setAttr('style', `left: ${x}px; top: ${y}px;`)
    }

    reposition(e){
        let n = {gap: 5, parentOverlap: false}
        if (!e.contains(this.suggestEl)){
            return null
        }
        let o = n
        for (let i, r=e.doc.createNodeIterator(e, NodeFilter.SHOW_TEXT); 
             (i = r.nextNode()) && this.suggestEl !== i;
            ) {
                o += i.textContent.length
        }
        return o
    }

    selectSuggestion(value: string, event: KeyboardEvent){
        console.log("this was selected................")
        console.log(value)
    }

    onSelectedChange(index: number, event: KeyboardEvent){

    }

    renderSuggestion(value: string, element: HTMLElement){
        element.createSpan({text: value})
    }
}


class Suggester {
    chooser: FloatingSuggester
    containerEl: HTMLElement
    values: string[]
    suggestions: HTMLElement[]
    selectedItem: number
    moveUp: KeymapEventListener
    moveDown: KeymapEventListener

    constructor(chooser: FloatingSuggester, element: HTMLElement, scope: Scope){
        let binding = this
        this.chooser = chooser
        this.containerEl = element
        this.values = []
        this.suggestions = []
        this.selectedItem = 0

        this.containerEl.on('click', '.sugtestion-item', this.onSuggestionClick.bind(this))
        this.containerEl.on('auxclick', '.sugtestion-item', this.onSuggestionClick.bind(this))
        this.containerEl.on('mousemove', '.sugtestion-item', this.onSuggestionMouseover.bind(this))

        this.moveUp = this._moveUp.bind(this)
        this.moveDown = this._moveDown.bind(this)

        scope.register([], "ArrowUp", this.moveUp)
        scope.register([], 'ArrowDown', this.moveDown)
        scope.register([], "Enter", (function(event) {
            if (!event.isComposing){
                return binding.useSelectedItem(event)
            }
        }))

    }

    _moveUp(event: KeyboardEvent){
        if (!event.isComposing){
            return this.setSelectedItem(this.selectedItem - 1, event)
        }
    }

    _moveDown(event: KeyboardEvent){
        if (!event.isComposing){
            return this.setSelectedItem(this.selectedItem + 1, event)
        }
    }

    onSuggestionClick(event: KeyboardEvent, ctx: HTMLElement){
        event.preventDefault()
        let index = this.suggestions.indexOf(ctx)
        this.setSelectedItem(index, event)
        this.useSelectedItem(event)
    }

    onSuggestionMouseover(event: KeyboardEvent, ctx: HTMLElement){
        let index = this.suggestions.indexOf(ctx)
        console.log('new item hovered: ' + index)
        this.setSelectedItem(index, event)
    }

    useSelectedItem(event: KeyboardEvent) {
        if (!this.values){
            return false
        }
        let selected = this.values[this.selectedItem]
        if (selected !== undefined){
            return this.chooser.selectSuggestion(selected, event)
        }
    }

    setSelectedItem(index: number, event: KeyboardEvent | null){
        let suggest = this.suggestions
        if (suggest.length !== 0){
            if (index < 0){
                index = suggest.length - 1
            } else {
                if (index >= suggest.length){
                    index = 0
                }
            }
        }
        this.forceSetSelectedItem(index, event)
    }

    forceSetSelectedItem(index: number, event: KeyboardEvent | null){
        let suggest = this.suggestions
        let active = suggest[this.selectedItem]
        if (active){
            active.removeClass("is-selected")
        }
        this.selectedItem = index
        let newly_active = suggest[this.selectedItem]
        if (newly_active){
            newly_active.addClass('is-selected')
        }
        if (event && event.instanceOf(KeyboardEvent)){
            newly_active.scrollIntoView({block: 'nearest'})
        }
        this.chooser.onSelectedChange.call(this.chooser, this.values[index], event)
    }

    setSuggestions(new_suggestions: string[]){
        let parent = this.containerEl
        parent.empty()
        var element_list: HTMLElement[] = []

        if (new_suggestions){
            for (var i=0; i < new_suggestions.length; i++){
                let value = new_suggestions[i]
                let element = parent.createDiv('suggestion-item')
                this.chooser.renderSuggestion(value, element)
                element_list.push(element)
            }
        }

        this.values = new_suggestions
        this.suggestions = element_list
        this.setSelectedItem(0, null)
        this.chooser.autoReposition()
    }


}