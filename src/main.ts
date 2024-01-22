import { Notice, Plugin, TFile, PluginSettingTab, Setting, Menu } from 'obsidian';
import { dynamicToggleCommand, dynamicAddMenuItems, addTagsWithModal, addTagWithModal, toggleTagOnActive,
	     selectTag, removeTagWithModal, removeTagsWithModal, constructTaggerContextMenu } from './utilities';
import { NonStarredTags } from './tag_gatherers';
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
	preffered_casing: string;
	priorityTags: StarredTag[];
	last_used_tag: string;
}

/** default settings for when none exist
 * 
 */
const DEFAULT_SETTINGS: QuickTaggerSettings = {
	all_tags: true,
	preffered_casing: 'None',
	priorityTags: [],
	last_used_tag: ''
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
		let starredTags = this.settings.priorityTags
		starredTags.forEach((t) => {
			if(t.add_command){
				dynamicToggleCommand(this, t)
			}
		})

		this._statusBarItem = new Array
		this.redrawButtons()

		// Ribbon Icons
		const addTagRibbonIcon = this.addRibbonIcon('tag', 'Add tag to current note', async (evt: MouseEvent) => {
			addTagWithModal(this)
		});

		const removeTagRibbonIcon = this.addRibbonIcon('x-square', 'Remove tag from current note', (evt: MouseEvent) => {
			removeTagWithModal(this)
		});


		// Command Pallet Commands
		this.addCommand({
			id: 'quick-add-tag',
			name: 'Add tag',
			callback: () => {
				addTagWithModal(this)
			}
		});

		this.addCommand({
			id: 'quick-remove-tag',
			name: 'Remove tag',
			callback: () => {
				removeTagWithModal(this)
			}
		});

		this.addCommand({
			id: 'repeat-last-tag',
			name: `Toggle recently used tag (none)`,
			callback: () => {
				new Notice("ERROR: No recent tag, please assign a tag with Quick Tagger before using this command")
			}
		})

		// Menu commands
		this.registerEvent(  // context menu when multiple items are selected in the file browser
			this.app.workspace.on("files-menu", (menu: Menu, files: TFile[]) => {
				files = onlyTaggableFiles(files)
				if(files.length < 1){return}
				constructTaggerContextMenu(menu, files, this)

				
			})
		)
		
		this.registerEvent(  // context menu when right clicking on a file (file browser, active tab header, )
			this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
				let files = onlyTaggableFiles([file])
				if(files.length < 1){return}
				constructTaggerContextMenu(menu, files, this)
			})
		)

		this.registerEvent(  // ... menu in search results window
			this.app.workspace.on("search:results-menu", (menu: Menu, leaf: any) => {
				let files = [] as TFile[]
				leaf.dom.vChildren.children.forEach((e: any) => files.push(e.file))  // TODO: there must be a better way to do this!
				files = onlyTaggableFiles(files)
				if(files.length < 1){return}
				constructTaggerContextMenu(menu, files, this)
			})
		)

		this.registerEvent(  // context menu when right-clicking content in edit mode.
			this.app.workspace.on('editor-menu', (menu: Menu, leaf: any) => {
				// TODO: figure out how to get files from the selection.
				// TODO: de-duplicate menu entries when right clicking on a link in edit mode.
				menu.addItem((item) => {
					item
					  .setTitle("testing")
					  .setIcon("tag")
				})
			})
		)

		this.registerEvent(  // `v` menu in the tab header
			this.app.workspace.on('tab-group-menu', (menu: Menu, group: any) => {
				console.log(Object.getPrototypeOf(group.children[0].view.file))
				let files = [] as TFile[]
				group.children.forEach((tab: any) => files.push(tab.view.file))
				files = onlyTaggableFiles(files)
				constructTaggerContextMenu(menu, files, this)
			})
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

	redrawButtons(){
		if (this._statusBarItem) {
			this._statusBarItem.forEach((t) => t.remove())
		}
		
		let starredTags = this.settings.priorityTags
		starredTags.forEach((t) => {
			if (t.status_bar){
				let item_to_add = this.addStatusBarItem()
				this._statusBarItem.push(item_to_add)
				item_to_add.classList.add("mod-clickable")
				item_to_add.setText(t.tag_value)
				item_to_add.setAttribute("aria-label", `Toggle #${t.tag_value} on active note`);
				item_to_add.setAttribute("aria-label-position", "top");
				item_to_add.addEventListener("click", async () => {
					toggleTagOnActive(this, t.tag_value)
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

	constructor(plugin: QuickTagPlugin) {
		super(plugin.app, plugin);
		this.app = plugin.app;
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// Style guide says not to use a main heading
		// https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Only%20use%20headings%20under%20settings%20if%20you%20have%20more%20than%20one%20section.
		// containerEl.createEl('h2', {text: 'Quick Tagger Settings'});

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

		containerEl.createEl('h1', { text: 'Starred tags' });
		containerEl.createEl('h2', "hello")

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
							this.plugin.redrawButtons()
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
