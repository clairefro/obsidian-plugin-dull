import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceRibbon,
} from "obsidian";
import * as dull from "utils/jimp";

// Remember to rename these classes and interfaces!

interface DullPluginSettings {
	algo: "greyscale" | "quantize" | "compress";
	bytesSaved: number;
	enabled: boolean;
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
	enabled: true,
};

export default class DullPlugin extends Plugin {
	settings: DullPluginSettings;
	statusBar: HTMLElement;
	ribbonIcon: HTMLElement;

	async onload() {
		console.log("Dull loading..");
		await this.loadSettings();

		this.addStatusBarItem();
		this.statusBar = this.addStatusBarItem();

		this.settings.bytesSaved &&
			this.statusBar.setText(this._statusText(this.settings.bytesSaved));

		// drop handler
		this.registerEvent(
			this.app.workspace.on(
				"editor-drop",
				async (evt: DragEvent, editor: Editor) => {
					if (!this.settings.enabled) return; // use default behavior if dull is disabled
					if (!evt.dataTransfer) return;

					evt.preventDefault();
					const { files } = evt.dataTransfer;

					for (let i = 0; i < files.length; i++) {
						const file = files.item(i);
						if (file) await this.processImage(file, editor);
					}
				}
			)
		);

		// paste handler
		this.registerEvent(
			this.app.workspace.on(
				"editor-paste",
				async (evt: ClipboardEvent, editor: Editor) => {
					if (!this.settings.enabled) return; // use default behavior if dull is disabled
					const { files } = evt.clipboardData || {};
					if (!files?.length) return;

					evt.preventDefault();
					for (let i = 0; i < files.length; i++) {
						const file = files.item(i);
						if (file) await this.processImage(file, editor);
					}
				}
			)
		);

		// This creates an icon in the left ribbon.
		this.ribbonIcon = this.addRibbonIcon(
			"image-down",
			"Toggle Dull",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				this.settings.enabled = !this.settings.enabled;
				this.saveSettings();
				this._updateRibbonIconState();
				new Notice(
					`Dull ${this.settings.enabled ? "enabled" : "disabled"}`
				);
				// not implementing modal for this for now
				// new DullModal(this.app).open();
			}
		);
		this.ribbonIcon.addClass("dull-ribbon-icon");
		this._updateRibbonIconState();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new DullSettingTab(this.app, this));
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

	private async processImage(file: File, editor: Editor) {
		const { fileManager, workspace, vault } = this.app;

		if (
			!(
				file?.type.startsWith("image/jpeg") ||
				file?.type.startsWith("image/png")
			)
		) {
			return;
		}

		const oldBuffer = await file.arrayBuffer();

		// run algo
		const newBuffer = await algos[this.settings.algo](
			oldBuffer,
			this.settings.quality
		);

		// write file
		const filename =
			file.name ||
			`pasted-image-${Date.now()}.${file.type.split("/")[1]}`;
		const path = await fileManager.getAvailablePathForAttachment(filename);
		const newFile = await vault.createBinary(path, newBuffer as any);

		editor.replaceRange(
			fileManager.generateMarkdownLink(
				newFile,
				workspace.getActiveFile()?.path!
			),
			editor.getCursor()
		);

		// notify results
		const bytesSaved = file.size - newFile.stat.size;
		new Notice(
			`${bytesSaved} bytes (${((bytesSaved / file.size) * 100).toFixed(
				0
			)}%)`
		);

		this.settings.bytesSaved += bytesSaved;
		this.statusBar.setText(this._statusText(this.settings.bytesSaved));
	}

	private _statusText(bytesSaved: number) {
		return `Dull: Saved ${bytesSaved} bytes total`;
	}
	private _updateRibbonIconState() {
		if (this.ribbonIcon) {
			const icon = this.ribbonIcon;
			if (icon) {
				icon.classList.remove("dull-enabled", "dull-disabled");
				icon.classList.add(
					this.settings.enabled ? "dull-enabled" : "dull-disabled"
				);
			}
		}
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
