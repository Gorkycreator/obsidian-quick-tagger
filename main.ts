import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { arrayBuffer } from 'stream/consumers';
import { QuickTagSelector } from './modal'
import { prepYaml, addTag, removeTag } from `./utilities`

interface QuickTaggerSettings {
	tags: string[];
	exclusive: boolean;
}

const DEFAULT_SETTINGS: QuickTaggerSettings = {
	tags: [],
	exclusive: false
}

export default class MyPlugin extends Plugin {
	settings: QuickTaggerSettings;

	async onload() {
		await this.loadSettings();

		const addTagRibbonIcon = this.addRibbonIcon('tag', 'Add Tag to Current Note', (evt: MouseEvent) => {
			new QuickTagSelector(this.app, 'add').open();
		});

		const removeTagRibbonIcon = this.addRibbonIcon('x-square', 'Remove Tag from Current Note', (evt: MouseEvent) => {
			new QuickTagSelector(this.app, 'remove').open();
		});

		// Quick Tagger Logic testing
		this.addCommand({
			id: 'quick-tag',
			name: 'Quick Tag',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				var note_text = editor.getValue()
				var updated_text = prepYaml(note_text, ['tags'])
				var tags = [this.settings.tags[0].replace("#", "")]
				for (var i=0; i<tags.length; i++){
					updated_text = removeTag(updated_text, tags[i])
				}
				editor.setValue(updated_text)
			}
		});

		// Quick Tagger Modal
		this.addCommand({
			id: 'open-quick-tagger',
			name: 'Open Quick Tagger',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						var test = new QuickTagSelector(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});


		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Tags')
			.setDesc('Select tags for quick tagging')
			.addTextArea(text => text
				.setPlaceholder('Enter tags seperated by commas.')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Updated tags: ' + value);
					var tags = value.split(",")
					tags = tags.map(s => s.trim())
					this.plugin.settings.tags = tags;
					await this.plugin.saveSettings();
				}));
	}
}
