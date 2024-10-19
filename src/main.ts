import { Notice, Plugin, PluginSettingTab, Setting, Menu, setIcon, ItemView, WorkspaceLeaf } from 'obsidian';
import { dynamicToggleCommand, addTagsToActiveFileWithModal, toggleTagOnActive,
	     selectTag, removeTagsFromActiveFileWithModal,
		 showStatusBarMenu, set_up_command_pallet, set_up_menu_commands } from './utilities';
import { NonStarredTags } from './tag_gatherers';
import { set_up_stashed_tags } from './tag_stash';
import { MultiTagSelectModal } from 'modal';


const TAG_STASH_VIEW = "tag-stash-view"


/** interface for starred tag settings
 * 
 */
export interface StarredTag {
	tag_value: string;
	cut_in_line: boolean;
	status_bar: boolean;
	add_command: boolean;
	right_click: boolean;
}

export interface SavedStash {
	name: string
	tags: string[]
}

/** interface for plugin settings as a whole
 * 
 */
export interface QuickTaggerSettings {
	all_tags: boolean;
	preffered_casing: string;
	priorityTags: StarredTag[];
	statusBarCount: number;
	last_used_tag: string;
	tag_stash: string[];
	saved_stashes: SavedStash[];
}

/** default settings for when none exist
 * 
 */
const DEFAULT_SETTINGS: QuickTaggerSettings = {
	all_tags: true,
	preffered_casing: 'None',
	priorityTags: [],
	statusBarCount: 3,
	last_used_tag: '',
	tag_stash: [""],
	saved_stashes: [],
}

/** Main class for plugin
 * 
 */
export default class QuickTagPlugin extends Plugin {
	settings: QuickTaggerSettings;
	_statusBarItem: HTMLElement
	_statusBarItemMenu: Menu
	_statusBarStarredTags: HTMLElement[]
	_tagStashListeners: Function[]

	async onload() {
		await this.loadSettings();
		this._tagStashListeners = []
		
		// Add Dynamic commands/status bar buttons
		let starredTags = this.settings.priorityTags
		starredTags.forEach((t) => {
			if(t.add_command){
				dynamicToggleCommand(this, t)
			}
		})

		set_up_stashed_tags(this)
		this.setupStatusBar();
		this._statusBarStarredTags = new Array
		this.redrawStatusBar()

		// Ribbon Icons
		const addTagRibbonIcon = this.addRibbonIcon('tag', 'Add tag to current note', async (evt: MouseEvent) => {
			addTagsToActiveFileWithModal(this)
		});

		const removeTagRibbonIcon = this.addRibbonIcon('x-square', 'Remove tag from current note', (evt: MouseEvent) => {
			removeTagsFromActiveFileWithModal(this)
		});

		set_up_command_pallet(this)
		set_up_menu_commands(this)

		// tag stash view
		this.registerView(
			TAG_STASH_VIEW,
			(leaf) => new TagStash(leaf, this)
		)

		this.addCommand({
			id: 'open-tag-stash',
			name: 'Open tag stash panel',
			callback: async () => {this.activateTagStash()}
		});


		this.registerEvent(
			this.app.vault.on('tag-stash-add', this.addToTagStash.bind(this))
		)

		this.registerEvent(
			this.app.vault.on('tag-stash-remove', this.removeFromTagStash.bind(this))
		)


		// This adds a settings tab so the user can configure letious aspects of the plugin
		this.addSettingTab(new QuickTagSettingTab(this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async addToTagStash(tags: string[]) {
		console.log("UPDATING TAG STASH")
		console.log(tags)
		console.log(this)

		tags.forEach((tag) => {
			this.settings.tag_stash.push(tag)
		})
		await this.saveSettings()
		this.update_stash_listeners()
		new Notice(`${tags} added to stash`)
	}

	async removeFromTagStash(tags: string[]){
		if (tags[0] == "REMOVE ALL"){
			console.log("removing all tags from stash.....")
			this.settings.tag_stash = new Array
		} else {
			let tag_array: string[] = []
			this.settings.tag_stash.forEach((tag) => {
				if (!tags.contains(tag)){
					tag_array.push(tag)
				}
			}
			)
			this.settings.tag_stash = tag_array
		}
		await this.saveSettings()
		this.update_stash_listeners()
	}

	async update_stash_listeners(){
		for (let i = 0; i < this._tagStashListeners.length; i++){
			this._tagStashListeners[i](this.settings.tag_stash)
		}
	}

	add_tag_stash_listener(f: Function){
		this._tagStashListeners.push(f)
	}

	async onunload() {
		this.settings.last_used_tag = ""
		await this.saveSettings()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	setupStatusBar() {
		this._statusBarItem = this.addStatusBarItem()
		this._statusBarItem.classList.add("mod-clickable")
		this._statusBarItem.setAttribute('aria-label', 'Click for quick tagging options')
		this._statusBarItem.setAttribute('data-tooltip-position', 'top')
		setIcon(this._statusBarItem, 'tags')

		this.registerDomEvent(this._statusBarItem, "click", () => showStatusBarMenu(this));
	}

	redrawStatusBar(){
		if (this._statusBarStarredTags) {
			this._statusBarStarredTags.forEach((t) => t.remove())
		}

		let starredTags = this.settings.priorityTags
		let buffer = this.settings.statusBarCount

		// Set up limited number of starred tag buttons
		for (let i = 0; i < starredTags.length; i++){
			let t = starredTags[i]
			if (t.status_bar){
				if (buffer < 1){
					continue
				}
				let item_to_add = this.addStatusBarItem()
				this._statusBarStarredTags.push(item_to_add)
				item_to_add.classList.add("mod-clickable")
				item_to_add.setText(t.tag_value)
				item_to_add.setAttribute("aria-label", `Toggle ${t.tag_value} on active note`);
				item_to_add.setAttribute("data-tooltip-position", "top");
				item_to_add.addEventListener("click", async () => {
					toggleTagOnActive(this, t.tag_value)
				});
				buffer--
			}
		}
	}

	async activateTagStash(){
		const { workspace } = this.app
		
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(TAG_STASH_VIEW);

		if (leaves.length > 0){
			leaf = leaves[0]
		} else {
			leaf = workspace.getRightLeaf(false)
			await leaf.setViewState({type: TAG_STASH_VIEW, active: true})
		}

		workspace.revealLeaf(leaf)
	}
}


/** Class for settings tab. Draws and sets up settings
 * 
 */
class QuickTagSettingTab extends PluginSettingTab {
	plugin: QuickTagPlugin;

	constructor(plugin: QuickTagPlugin) {
		super(plugin.app, plugin);
		this.app = plugin.app;
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Use all tags')
			.setDesc('If disabled, only Starred Tags will be shown in the tag selection dialog.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.all_tags)
				.onChange(async (value) => {
					this.plugin.settings.all_tags = value;
					await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
			.setName('Preferred tag case')
			.setDesc('Helper to replace spaces in input with a preffered tag style. "None" will just remove invalid characters.')
			.addDropdown(dropdown => dropdown
				.addOption('none', "None")
				.addOption('camelcase', "applyCamelCase")
				.addOption('pascalcase', "ApplyPascalCase")
				.addOption('snakecase', "apply_snake_case")
				.addOption('kebabcase', "apply-kebab-case")
				.setValue(this.plugin.settings.preffered_casing)
				.onChange(async (value) => {
					this.plugin.settings.preffered_casing = value;
					await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
			.setName('Number of tags to show on the status bar')
			.setDesc('Controls how many starred tags will be shown directly on the status bar. Others will be placed in a pop-up menu.')
			.addSlider((component) => {
				component.onChange(async (value) => {
					this.plugin.settings.statusBarCount = value
					await this.plugin.saveSettings();
					this.plugin.redrawStatusBar();
				})
				.setLimits(0, 20, 1)
				.setValue(this.plugin.settings.statusBarCount)
				.setDynamicTooltip()
			})


		containerEl.createEl('h1', { text: 'Starred tags' });

		const starredDiv = containerEl.createDiv();
		this.drawPriorityTags(starredDiv);
		
		new Setting(containerEl)
		    .addButton(btn => btn
			    .setTooltip("Add a starred tag")
				.onClick(async () => {
					let thisTag = await selectTag(this.plugin, new NonStarredTags)
					
					this.plugin.settings.priorityTags.push({
						tag_value: thisTag,
						cut_in_line: true,
						add_command: false,
						status_bar: false,
						right_click: false
					})
					await this.plugin.saveSettings();
					this.drawPriorityTags(starredDiv)
				})
				.setIcon("plus"))
	}

	drawPriorityTags(div: HTMLElement) {
		div.empty();
		const priorityTags = this.plugin.settings.priorityTags

		new Setting(div)
		.addButton(btn => {
			btn.setIcon('star');
			let msg = "The first toggle on a starred tag moves it to the top of the list when selecting a tag for your notes.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('chevron-right-square');
			let msg = "The second toggle on a starred tag adds a command for it so you can create a hotkey, etc.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('martini');
			let msg = "The third toggle on a starred tag adds a button for it to the status bar.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('mouse-pointer-click');
			let msg = "The fourth toggle on a starred tag adds it to the context menu.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('up-arrow-with-tail');
			let msg = "The up arrow button moves the starred tag up on the starred tag list. This affects the order it's displayed in the tag selection dialog.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('down-arrow-with-tail');
			let msg = "The down arrow button moves the starred tag down on the starred tag list. This affects the order it's displayed in the tag selection dialog.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('trash');
			let msg = "The trash can button removes the starred tag from the starred list.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.nameEl.setText("Starred tags get special treatment. Click or hover over these buttons for more details 👉")


		priorityTags.forEach((tag, i) => {
			const s = new Setting(div)
					.addToggle(toggle => {
						toggle
						.setValue(tag.cut_in_line)
						.onChange(async (value) => {
							tag.cut_in_line = value;
							await this.plugin.saveSettings();
							new Notice(tag.cut_in_line ? `Added ${tag.tag_value} to priority section of selector dialog` : `Removed ${tag.tag_value} from priority section of selector dialog`)
						});
						toggle.setTooltip("Show first in tag selection dialog")
					})
					.addToggle(toggle => {
						toggle
						.setValue(tag.add_command)
						.onChange(async (value) => {
							tag.add_command = value;
							await this.plugin.saveSettings();
							dynamicToggleCommand(this.plugin, tag);
							new Notice(tag.add_command ? `Added ${tag.tag_value} command` : `Removed ${tag.tag_value} command`)
						});
						toggle.setTooltip("Add command for this tag")
					})
					.addToggle(toggle => {
						toggle
						.setValue(tag.status_bar)
						.onChange(async (value) => {
							tag.status_bar = value;
							await this.plugin.saveSettings();
							new Notice(tag.status_bar ? `Added ${tag.tag_value} button to status bar` : `Removed ${tag.tag_value} button from status bar`)
							this.plugin.redrawStatusBar()
						});
						toggle.setTooltip("Add button to status bar")
					})
					.addToggle(toggle => {
						toggle
						.setValue(tag.right_click)
						.onChange(async (value) => {
							tag.right_click = value;
							await this.plugin.saveSettings();
							new Notice(tag.right_click ? `Added ${tag.tag_value} to right-click menu` : `Removed ${tag.tag_value} from right-click menu`)
						});
						toggle.setTooltip("Add context menu entry")
					})
					.addButton(button => {
						button.onClick(async () => {
							const oldTag = priorityTags[i-1];
							priorityTags[i-1] = tag;
							priorityTags[i] = oldTag;
							this.drawPriorityTags(div);
							await this.plugin.saveSettings();
							this.plugin.redrawStatusBar()
						})
						button.setIcon("up-arrow-with-tail");
						button.setTooltip("Move Starred tag up")
						if (i === 0){
							button.setDisabled(true);
						}
					})
					.addButton(button => {
						button.onClick(async () => {
							const oldTag = priorityTags[i+1];
							priorityTags[i+1] = tag;
							priorityTags[i] = oldTag;
							this.drawPriorityTags(div);
							await this.plugin.saveSettings();
							this.plugin.redrawStatusBar()
						})
						button.setIcon("down-arrow-with-tail");
						button.setTooltip("Move Starred tag down")
						if (i === priorityTags.length - 1){
							button.setDisabled(true);
						}
					})
					.addButton(btn => {
						btn.onClick(async () => {
							priorityTags.remove(tag)
							await this.plugin.saveSettings();
							this.drawPriorityTags(div)
						})
						btn.setIcon("trash")
						btn.setTooltip("Remove this tag")
					});
				s.nameEl.createEl('div', { text: tag.tag_value })
		})
	}
}


// region Tag Stash Panel

/** Class for Tag Stash panel
 * 
 */
class TagStash extends ItemView {
	plugin: QuickTagPlugin
	input_box: MultiTagSelectModal


	constructor(leaf: WorkspaceLeaf, plugin: QuickTagPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getDisplayText(): string {
		return "Tag stash"
	}

	getViewType(): string {
		return TAG_STASH_VIEW
	}
	
	async onOpen(){
		const container = this.containerEl.children[1]
		container.empty()

		this.input_box = new MultiTagSelectModal(container.createEl('div'), this.plugin)
		
		let view = this
		this.input_box.update_hook = function() {
			// TODO: trigger event to update stash
			let current_tags = this.get_tags()
			let setting_tags = view.plugin.settings.tag_stash

			let update_tags = current_tags.filter((tag: string) => !setting_tags.includes(tag))
			let remove_tags = setting_tags.filter((tag: string) => !current_tags.includes(tag))
			
			if (update_tags.length > 0){
				console.log('adding tags')
				view.plugin.app.vault.trigger('tag-stash-add', update_tags, view.plugin)
			}

			if (remove_tags.length > 0){
				console.log("removing tags")
				console.log(remove_tags)
				view.plugin.app.vault.trigger('tag-stash-remove', remove_tags, view.plugin)
			}
		}

		this.plugin.add_tag_stash_listener(this.input_box.inject_new_data_hook.bind(this.input_box))
	}

	async onClose() {
		// No cleanup necessary
	}

	getIcon(): string {
		return "squirrel"
	}
}