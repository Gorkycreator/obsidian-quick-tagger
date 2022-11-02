import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, SliderComponent } from 'obsidian';
import { arrayBuffer } from 'stream/consumers';
import { QuickTagSelector } from './modal'
import { prepYaml, addTag, removeTag } from `./utilities`

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

		const addTagRibbonIcon = this.addRibbonIcon('tag', 'Add Tag to Current Note', (evt: MouseEvent) => {
			new QuickTagSelector(this.app, this.settings, 'add').open();
		});

		const removeTagRibbonIcon = this.addRibbonIcon('x-square', 'Remove Tag from Current Note', (evt: MouseEvent) => {
			new QuickTagSelector(this.app, this.settings, 'remove').open();
		});

		// Quick Tagger Logic testing
		this.addCommand({
			id: 'quick-add-tag',
			name: 'Add Tag',
			callback: () => {
				new QuickTagSelector(this.app, this.settings, 'add').open()
			}
		});

		// Quick Tagger Modal
		this.addCommand({
			id: 'open-quick-tagger',
			name: 'Remove Tag',
			callback: () => {
				new QuickTagSelector(this.app, this.settings, 'remove').open()
			}
		});


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
			.setName('Favorite Tags')
			.setDesc('Favorite tags to show up at the top of the list, in the order listed here. Seperate tags with commas.')
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
			.setDesc('If disabled, only Favorite Tags will be shown')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.all_tags)
				.onChange(async (value) => {
					this.plugin.settings.all_tags = value;
					await this.plugin.saveSettings();
			}));
	}
}
