import { App, Editor, MarkdownView, Modal, Notice, Plugin, TFile, PluginSettingTab, Setting, SliderComponent, SearchResult, sortSearchResults } from 'obsidian';
import { QuickTagSelector, ConfirmModal } from './modal'
import { getActiveFile, collectExistingTags, onlyTaggableFiles } from './utilities';

export interface QuickTaggerSettings {
	tags: string;
	all_tags: boolean;
}

const DEFAULT_SETTINGS: QuickTaggerSettings = {
	tags: '',
	all_tags: true
}

export default class QuickTagPlugin extends Plugin {
	settings: QuickTaggerSettings;

	async onload() {
		await this.loadSettings();
		
		

		//Ribbon Icons
		const addTagRibbonIcon = this.addRibbonIcon('tag', 'Add Tag to Current Note', (evt: MouseEvent) => {
			var currentFile = getActiveFile()
			new QuickTagSelector(this, currentFile, 'add').open();
		});

		const removeTagRibbonIcon = this.addRibbonIcon('x-square', 'Remove Tag from Current Note', (evt: MouseEvent) => {
			var currentFile = getActiveFile()
			new QuickTagSelector(this, currentFile, 'remove').open();
		});


		// Command Pallet Commands
		this.addCommand({
			id: 'quick-add-tag',
			name: 'Add Tag',
			callback: () => {
				var currentFile = getActiveFile()
				new QuickTagSelector(this, currentFile, 'add').open()
			}
		});

		this.addCommand({
			id: 'open-quick-tagger',
			name: 'Remove Tag',
			callback: () => {
				var currentFile = getActiveFile()
				new QuickTagSelector(this, currentFile, 'remove').open()
			}
		});

		this.addCommand({
			id: 'test-quick-tagger',
			name: 'debug test',
			callback: () => {
				console.log("DEBUG TEST!!!!")

				var myFile = getActiveFile()[0]
				if(myFile){
					this.app.fileManager.processFrontMatter(myFile, (frontmatter: object) => {
						frontmatter = collectExistingTags(frontmatter)
					})
				}
			}
		})

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
						new QuickTagSelector(this, files, 'add').open()
					  })
				})
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
						new QuickTagSelector(this, files, 'remove').open()
					  })
				})
			})
		)

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				var thisFile = onlyTaggableFiles([file])
				if(thisFile.length < 1){return} else {file = thisFile[0]}
				menu.addItem((item) =>{
					item
					  .setTitle("Tag file with...")
					  .setIcon("tag")
					  .onClick(() => {
						var filteredFile = onlyTaggableFiles([file])
						if(filteredFile.length < 1){return}
						new QuickTagSelector(this, filteredFile, 'add').open()
					  })
				})
			})
		)

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				var thisFile = onlyTaggableFiles([file])
				if(thisFile.length < 1){return} else {file = thisFile[0]}
				menu.addItem((item) =>{
					item
					  .setTitle("Remove Tag(s)...")
					  .setIcon("tag")
					  .onClick(() => {
						var filteredFile = onlyTaggableFiles([file])
						if(filteredFile.length < 1){return}
						new QuickTagSelector(this, filteredFile, 'remove').open()
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
						new QuickTagSelector(this, files, 'add').open()
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
				
				menu.addItem((item) =>{
					item
					  .setTitle("Remove Tags from " + files.length + " notes...")
					  .setIcon("tag")
					  .onClick(() => {						
						new QuickTagSelector(this, files, 'remove').open()
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
}


class QuickTagSettingTab extends PluginSettingTab {
	plugin: QuickTagPlugin;

	constructor(app: App, plugin: QuickTagPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Quick Tagger Settings'});

		new Setting(containerEl)
			.setName('Priority Tags')
			.setDesc('Priority tags to show up at the top of the list, in the order listed here. Seperate tags with commas.')
			.addTextArea(text => text
				.setPlaceholder('Enter tags seperated by commas.')
				.setValue(this.plugin.settings.tags)
				.onChange(async (value) => {
					console.log('Updated tags: ' + value);
					this.plugin.settings.tags = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Use All Tags')
			.setDesc('If disabled, only Priority Tags will be shown')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.all_tags)
				.onChange(async (value) => {
					this.plugin.settings.all_tags = value;
					await this.plugin.saveSettings();
			}));
	}
}
