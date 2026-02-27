import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	const documentProvider = new DocumentTreeProvider();
	vscode.window.registerTreeDataProvider('mcp-docs', documentProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.refreshList', () => documentProvider.refresh()),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.copyPathForAI', (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			const prompt = `Please analyze this document: ${filePath}`;
			vscode.env.clipboard.writeText(prompt);
			vscode.window.showInformationMessage('Copied prompt to clipboard!');
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.previewDocument', async (node: DocumentNode | vscode.Uri) => {
			const filePath = node instanceof vscode.Uri ? node.fsPath : node.filePath;
			// Provide a quick note as a virtual document
			const uri = vscode.Uri.parse(`untitled:Preview-${path.basename(filePath)}.txt`);
			const doc = await vscode.workspace.openTextDocument(uri);
			const editor = await vscode.window.showTextDocument(doc);

			// Note: Since importing the huge backend package into an extension 
			// has bundling complications, we simply copy the path for the real backend
			// or we instruct the user to use the MCP Server.
			editor.edit(editBuilder => {
				editBuilder.insert(new vscode.Position(0, 0),
					`// This is a placeholder preview for ${path.basename(filePath)}\n` +
					`// To actually extract text, ask your AI: "Read this document: ${filePath}"\n\n` +
					`// Path: ${filePath}`
				);
			});
		}),

		vscode.commands.registerCommand('pdf-ppt-mcp-explorer.installMcpServer', async () => {
			const configPath = path.join(process.env.APPDATA || process.env.HOME || '', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');

			if (fs.existsSync(configPath)) {
				try {
					const content = fs.readFileSync(configPath, 'utf-8');
					const json = JSON.parse(content);

					if (!json.mcpServers) json.mcpServers = {};
					json.mcpServers["pdf-ppt"] = {
						"command": "npx",
						"args": ["-y", "pdf-ppt-mcp@latest"]
					};

					fs.writeFileSync(configPath, JSON.stringify(json, null, 2));
					vscode.window.showInformationMessage('Successfully added pdf-ppt-mcp to Cline settings!');
				} catch (e) {
					vscode.window.showErrorMessage('Failed to parse cline_mcp_settings.json');
				}
			} else {
				vscode.env.clipboard.writeText(`{\n  "mcpServers": {\n    "pdf-ppt": {\n      "command": "npx",\n      "args": ["-y", "pdf-ppt-mcp@latest"]\n    }\n  }\n}`);
				vscode.window.showWarningMessage('Cline not found. Copied raw JSON config to clipboard instead.');
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
