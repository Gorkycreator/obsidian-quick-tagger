import { App, Notice, Plugin, TFile, PluginSettingTab, Setting } from 'obsidian';
import { dynamicToggleCommand, dynamicAddMenuItems, addTagsWithModal, addTagWithModal,
	toggleTagOnActive, selectTag, removeTagWithModal, removeTagsWithModal } from './utilities';
import { getNonStarredTags } from './tag_gatherers';
import { onlyTaggableFiles } from './file_filters';


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

/** interface for plugin settings as a whole
 * 
 */
export interface QuickTaggerSettings {
	all_tags: boolean;
	priorityTags: StarredTag[];
}

/** default settings for when none exist
 * 
 */
const DEFAULT_SETTINGS: QuickTaggerSettings = {
	all_tags: true,
	priorityTags: []
}


/** Main class for plugin
 * 
 */
export default class QuickTagPlugin extends Plugin {
	settings: QuickTaggerSettings;
	_statusBarItem: HTMLElement[]

	async onload() {
		await this.loadSettings();
		
		// Add Dynamic commands/status bar buttons
		var starredTags = this.settings.priorityTags
		starredTags.forEach((t) => {
			if(t.add_command){
				dynamicToggleCommand(app, this, t)
			}
		})

		this._statusBarItem = new Array
		this.redrawButtons()

		// Ribbon Icons
		const addTagRibbonIcon = this.addRibbonIcon('tag', 'Add Tag to Current Note', async (evt: MouseEvent) => {
			addTagWithModal(this)
		});

		const removeTagRibbonIcon = this.addRibbonIcon('x-square', 'Remove Tag from Current Note', (evt: MouseEvent) => {
			removeTagWithModal(this)
		});


		// Command Pallet Commands
		this.addCommand({
			id: 'quick-add-tag',
			name: 'Add Tag',
			callback: () => {
				addTagWithModal(this)
			}
		});

		this.addCommand({
			id: 'open-quick-tagger',
			name: 'Remove Tag',
			callback: () => {
				removeTagWithModal(this)
			}
		});

		// File Context menu commands
		this.registerEvent(
			this.app.workspace.on("files-menu", (menu, files) => {
				files = onlyTaggableFiles(files)
				if(files.length < 1){return}
				menu.addItem((item) =>{
					item
					  .setTitle("Tag " + files.length + " files with...")
					  .setIcon("tag")
					  .onClick(() => {
						addTagsWithModal(this, files)
					  })
				})
			})
		)

		this.registerEvent(
			this.app.workspace.on('files-menu', (menu, files) => {
				if(files.length < 1){return}
				dynamicAddMenuItems(menu, files, this)
			})
		)

		this.registerEvent(
			this.app.workspace.on("files-menu", (menu, files) => {
				files = onlyTaggableFiles(files)
				if(files.length < 1){return}
				menu.addItem((item) =>{
					item
					  .setTitle("Remove Tag from " + files.length + " files...")
					  .setIcon("tag")
					  .onClick(() => {
						removeTagsWithModal(this, files)
					  })
				})
			})
		)

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				var thisFile = onlyTaggableFiles([file])
				if(thisFile.length < 1){return}
				menu.addItem((item) =>{
					item
					  .setTitle("Tag file with...")
					  .setIcon("tag")
					  .onClick(() => {
						addTagsWithModal(this, thisFile)
					  })
				})
			})
		)

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				var thisFile = onlyTaggableFiles([file])
				if(thisFile.length < 1){return}
				dynamicAddMenuItems(menu, thisFile, this)
			})
		)

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				var thisFile = onlyTaggableFiles([file])
				if(thisFile.length < 1){return}
				menu.addItem((item) =>{
					item
					  .setTitle("Remove Tag(s)...")
					  .setIcon("tag")
					  .onClick(() => {
						removeTagsWithModal(this, thisFile)
					  })
				})
			})
		)

		// Search Results menu commands
		this.registerEvent(
			this.app.workspace.on("search:results-menu", (menu, leaf) => {
				var files = [] as TFile[]
				leaf.dom.vChildren.children.forEach((e) => files.push(e.file))  // TODO: there must be a better way to do this
				files = onlyTaggableFiles(files)
				if(files.length < 1){return}

				menu.addItem((item) =>{
					item
					  .setTitle("Add Tags to " + files.length + " notes...")
					  .setIcon("tag")
					  .onClick(() => {
						addTagsWithModal(this, files)
					  })
				})
			})
		)

		this.registerEvent(
			this.app.workspace.on("search:results-menu", (menu, leaf) => {
				var files = [] as TFile[]
				leaf.dom.vChildren.children.forEach((e) => files.push(e.file))  // TODO: there must be a better way to do this
				files = onlyTaggableFiles(files)
				if(files.length < 1){return}

				dynamicAddMenuItems(menu, files, this)
			})
		)

		this.registerEvent(
			this.app.workspace.on("search:results-menu", (menu, leaf) => {
				var files = [] as TFile[]
				leaf.dom.vChildren.children.forEach((e) => files.push(e.file))  // TODO: there must be a better way to do this
				files = onlyTaggableFiles(files)
				if(files.length < 1){return}
				
				menu.addItem((item) =>{
					item
					  .setTitle("Remove Tags from " + files.length + " notes...")
					  .setIcon("tag")
					  .onClick(() => {						
						removeTagsWithModal(this, files)
					  })
				})
			})
		)

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new QuickTagSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	redrawButtons(){
		if (this._statusBarItem) {
			this._statusBarItem.forEach((t) => t.remove())
		}
		
		var starredTags = this.settings.priorityTags
		starredTags.forEach((t) => {
			if (t.status_bar){
				var item_to_add = this.addStatusBarItem()
				this._statusBarItem.push(item_to_add)
				item_to_add.classList.add("mod-clickable")
				item_to_add.setText(t.tag_value)
				item_to_add.setAttribute("aria-label", `Toggle #${t.tag_value} on active note`);
				item_to_add.setAttribute("aria-label-position", "top");
				item_to_add.addEventListener("click", async () => {
					toggleTagOnActive(t.tag_value)
				});
			}
		}
		)
	}
}


/** Class for settings tab. Draws and sets up settings
 * 
 */
class QuickTagSettingTab extends PluginSettingTab {
	plugin: QuickTagPlugin;

	constructor(app: App, plugin: QuickTagPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.app = app;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Quick Tagger Settings'});

		new Setting(containerEl)
			.setName('Use All Tags')
			.setDesc('If disabled, only Starred Tags will be shown in the tag selection dialog.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.all_tags)
				.onChange(async (value) => {
					this.plugin.settings.all_tags = value;
					await this.plugin.saveSettings();
			}));

		containerEl.createEl('h1', { text: 'Starred Tags' });
		containerEl.createEl('h2', "hello")

		const starredDiv = containerEl.createDiv();
		this.drawPriorityTags(starredDiv);
		
		new Setting(containerEl)
		    .addButton(btn => btn
			    .setTooltip("Add a starred tag")
				.onClick(async () => {
					let thisTag = await selectTag(this.plugin, getNonStarredTags)
					
					console.log("SETTING FUNCTION")
					// console.log(selectedTag)
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
			var msg = "The first toggle on a starred tag moves it to the top of the list when selecting a tag for your notes.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('chevron-right-square');
			var msg = "The second toggle on a starred tag adds a command for it so you can create a hotkey, etc.  --- NOT IMPLEMENTED";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('martini');
			var msg = "The third toggle on a starred tag adds a button for it to the status bar.  --- NOT IMPLEMENTED";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('mouse-pointer-click');
			var msg = "The fourth toggle on a starred tag adds it to the context menu.  --- NOT IMPLEMENTED";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('up-arrow-with-tail');
			var msg = "The up arrow button moves the starred tag up on the starred tag list. This affects the order it's displayed in the tag selection dialog.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('down-arrow-with-tail');
			var msg = "The down arrow button moves the starred tag down on the starred tag list. This affects the order it's displayed in the tag selection dialog.";
			btn.onClick(() => new Notice(msg,6000))
			btn.setTooltip(msg)
		})
		.addButton(btn => {btn.setIcon('trash');
			var msg = "The trash can button removes the starred tag from the starred list.";
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
							dynamicToggleCommand(this.app, this.plugin, tag);
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
							this.plugin.redrawButtons()
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
							this.plugin.redrawButtons()
						})
						button.setIcon("up-arrow-with-tail");
						button.setTooltip("Move Starred Tag up")
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
							this.plugin.redrawButtons()
						})
						button.setIcon("down-arrow-with-tail");
						button.setTooltip("Move Starred Tag down")
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
						btn.setTooltip("Remove this Tag")
					});
				s.nameEl.innerHTML = tag.tag_value
		})
	}
}
