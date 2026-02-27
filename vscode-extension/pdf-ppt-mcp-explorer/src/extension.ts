import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	const documentProvider = new DocumentTreeProvider();
	vscode.window.registerTreeDataProvider('mcp-docs', documentProvider);

	// Set up file watchers to automatically refresh the sidebar
	const watcher = vscode.workspace.createFileSystemWatcher('**/*.{pdf,docx,xlsx,xls,pptx,ppt,csv}');
	watcher.onDidCreate(() => documentProvider.refresh());
	watcher.onDidChange(() => documentProvider.refresh());
	watcher.onDidDelete(() => documentProvider.refresh());
	context.subscriptions.push(watcher);

	context.subscriptions.push(
		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.refreshList', () => documentProvider.refresh()),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.copyPathForAI', (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			const config = vscode.workspace.getConfiguration('pdfPptMcpExplorer');
			const defaultPrompt = config.get<string>('defaultPrompt', 'Please thoroughly analyze this document and provide a summary:');
			const prompt = `${defaultPrompt}\n\n${filePath}`;
			vscode.env.clipboard.writeText(prompt);
			vscode.window.showInformationMessage('Copied prompt to clipboard!');
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.askAI', async (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			const question = await vscode.window.showInputBox({
				prompt: `What do you want to ask the AI about ${path.basename(filePath)}?`,
				placeHolder: "e.g., What are the main takeaways from this document?"
			});
			if (question) {
				const prompt = `Regarding the document at: ${filePath}\n\nQuestion: ${question}\n\nPlease read the document and answer the question.`;
				vscode.env.clipboard.writeText(prompt);
				vscode.window.showInformationMessage('Prompt copied! Paste it in your AI Assistant.');
			}
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.openExternally', async (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			vscode.env.openExternal(vscode.Uri.file(filePath));
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.revealInOS', async (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(filePath));
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.deleteFile', async (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			const selection = await vscode.window.showWarningMessage(`Are you sure you want to permanently delete ${path.basename(filePath)}?`, { modal: true }, 'Delete');
			if (selection === 'Delete') {
				await vscode.workspace.fs.delete(vscode.Uri.file(filePath), { useTrash: true });
			}
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.addExternalFile', async () => {
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('You must have a workspace folder open to add external files.');
				return;
			}
			const uris = await vscode.window.showOpenDialog({
				canSelectMany: true,
				openLabel: 'Add to Workspace',
				filters: { 'Supported Documents': ['pdf', 'docx', 'xlsx', 'xls', 'pptx', 'ppt', 'csv'] }
			});
			if (uris && uris.length > 0) {
				const targetFolder = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, '.mcp-docs');
				if (!fs.existsSync(targetFolder.fsPath)) {
					fs.mkdirSync(targetFolder.fsPath);
				}
				for (const uri of uris) {
					const dest = vscode.Uri.joinPath(targetFolder, path.basename(uri.fsPath));
					await vscode.workspace.fs.copy(uri, dest, { overwrite: true });
				}
				vscode.window.showInformationMessage(`Added ${uris.length} file(s) to the workspace!`);
			}
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.previewDocument', async (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			const uri = vscode.Uri.parse(`untitled:Preview-${path.basename(filePath)}.txt`);
			const doc = await vscode.workspace.openTextDocument(uri);
			const editor = await vscode.window.showTextDocument(doc);

			editor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(0, 0),
					`// This is a placeholder preview for ${path.basename(filePath)}\n` +
					`// To actually extract text, ask your AI: "Read this document: ${filePath}"\n\n` +
					`// Path: ${filePath}`
				);
			});
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.installMcpServer', async () => {
			const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');

			// Checks for both Roo Code and Cline configurations
			const configPaths = [
				path.join(appData, 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
				path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
				// Cursor path
				path.join(appData, 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
				path.join(appData, 'Cursor', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')
			];

			let success = false;

			for (const configPath of configPaths) {
				if (fs.existsSync(configPath)) {
					try {
						const content = fs.readFileSync(configPath, 'utf-8');
						const json = JSON.parse(content || '{}');

						if (!json.mcpServers) json.mcpServers = {};
						json.mcpServers["pdf-ppt"] = {
							"command": "npx",
							"args": ["-y", "pdf-ppt-mcp@latest"]
						};

						fs.writeFileSync(configPath, JSON.stringify(json, null, 2));
						success = true;
					} catch (e) {
						// Continue if we fail to parse one file
					}
				}
			}

			if (success) {
				vscode.window.showInformationMessage('Successfully auto-configured pdf-ppt-mcp across active AI assistants!');
			} else {
				vscode.env.clipboard.writeText(`{\n  "mcpServers": {\n    "pdf-ppt": {\n      "command": "npx",\n      "args": ["-y", "pdf-ppt-mcp@latest"]\n    }\n  }\n}`);
				vscode.window.showWarningMessage('AI Assistant configs not found. Copied JSON snippet to clipboard to paste manually.');
			}
		})
	);
}

class DocumentNode extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly filePath: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.tooltip = this.filePath;
		this.contextValue = path.extname(filePath).toLowerCase().replace('.', '');

		switch (this.contextValue) {
			case 'pdf': this.iconPath = new vscode.ThemeIcon('file-pdf'); break;
			case 'docx': this.iconPath = new vscode.ThemeIcon('file-word'); break;
			case 'csv':
			case 'xlsx': this.iconPath = new vscode.ThemeIcon('file-excel'); break;
			case 'ppt':
			case 'pptx': this.iconPath = new vscode.ThemeIcon('layout'); break;
			default: this.iconPath = new vscode.ThemeIcon('file-code'); break;
		}
	}
}

class DocumentTreeProvider implements vscode.TreeDataProvider<DocumentNode> {
	private _onDidChangeTreeData: vscode.EventEmitter<DocumentNode | undefined | null | void> = new vscode.EventEmitter<DocumentNode | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<DocumentNode | undefined | null | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: DocumentNode): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: DocumentNode): Promise<DocumentNode[]> {
		if (!vscode.workspace.workspaceFolders) {
			return [];
		}

		if (element) {
			return [];
		} else {
			// Find all supported docs in workspace
			const uris = await vscode.workspace.findFiles('**/*.{pdf,docx,xlsx,xls,pptx,ppt,csv}', '**/node_modules/**');

			return uris.map(uri => {
				const name = path.basename(uri.fsPath);
				return new DocumentNode(name, uri.fsPath, vscode.TreeItemCollapsibleState.None);
			}).sort((a, b) => a.label.localeCompare(b.label));
		}
	}
}

export function deactivate() { }
