import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import * as dull from "utils/jimp";

// Remember to rename these classes and interfaces!

interface DullPluginSettings {
	algo: "greyscale" | "quantize" | "compress";
	bytesSaved: number;
	quality: number;
}

const algos = {
	greyscale: dull.greyscale,
	quantize: dull.quantize,
	compress: dull.compress,
};

const DEFAULT_SETTINGS: DullPluginSettings = {
	algo: "compress",
	bytesSaved: 0,
	quality: 50,
};

export default class DullPlugin extends Plugin {
	settings: DullPluginSettings;
	statusBar: HTMLElement;

	async onload() {
		console.log("Dull loading..");
		await this.loadSettings();

		this.addStatusBarItem();
		this.statusBar = this.addStatusBarItem();

		this.registerEvent(
			this.app.workspace.on(
				"editor-drop",
				async (evt: DragEvent, editor: Editor) => {
					if (!evt.dataTransfer) {
						return;
					}
					evt.preventDefault();
					const { files } = evt.dataTransfer;
					const { fileManager, workspace, vault } = this.app;

					for (let i = 0; i < files.length; i++) {
						const file = files.item(i);
						if (
							!(
								file?.name?.endsWith(".jpg") ||
								file?.name?.endsWith(".png")
							)
						)
							return;

						const oldBuffer = await file.arrayBuffer();

						// run algo
						const newBuffer = await algos[this.settings.algo](
							oldBuffer,
							this.settings.quality
						);

						// write file
						const path =
							await fileManager.getAvailablePathForAttachment(
								file.name
							);
						const newFile = await vault.createBinary(
							path,
							newBuffer as any
						);
						editor.replaceRange(
							fileManager.generateMarkdownLink(
								newFile,
								workspace.getActiveFile()?.path!
							),
							editor.getCursor()
						);

						// share results
						const bytesSaved = file.size - newFile.stat.size;
						new Notice(
							`dull just saved you: ${bytesSaved} bytes (${(
								(bytesSaved / file.size) *
								100
							).toFixed(0)}%)`
						);

						this.settings.bytesSaved += bytesSaved;
						this.statusBar.setText(
							`dull has saved you ${this.settings.bytesSaved} bytes total`
						);
					}
				}
			)
		);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"image-down",
			"dull",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new DullModal(this.app).open();
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new DullModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new DullModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new DullSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, "click", (evt: MouseEvent) => {
		// 	console.log("click", evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class DullModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class DullSettingTab extends PluginSettingTab {
	plugin: DullPlugin;

	constructor(app: App, plugin: DullPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Algorithm")
			.setDesc("The algorithm used on your image")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("greyscale", "Greyscale")
					.addOption("quantize", "Quantize")
					.addOption("compress", "Compress")
					.setValue(this.plugin.settings.algo) // Set the current value from plugin settings
					.onChange((value: DullPluginSettings["algo"]) => {
						this.plugin.settings.algo = value;
						this.plugin.saveData(this.plugin.settings);
					})
			);

		new Setting(containerEl)
			.setName("Quality")
			.setDesc("Use the slider to adjust the value.")
			.addSlider((slider) =>
				slider
					.setLimits(1, 100, 1)
					.setValue(this.plugin.settings.quality)
					.onChange((value) => {
						this.plugin.settings.quality = value;
						this.plugin.saveData(this.plugin.settings);
					})
			);

		new Setting(containerEl)
			.setName("Reset bytes saved")
			.setDesc("Click to reset your bytes saved value")
			.addButton((button) =>
				button
					.onClick(() => (this.plugin.settings.bytesSaved = 0))
					.setButtonText("Reset")
			);
	}
}
