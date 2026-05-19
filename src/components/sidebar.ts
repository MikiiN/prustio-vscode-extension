import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class PrustioTaskProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return []; 
        } 
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // check if workspace is opened and contains Prustio.toml file
        if (!workspaceRoot || !fs.existsSync(path.join(workspaceRoot, 'Prustio.toml'))) {
            return [this.createTaskItem('Create New Project', 'prustio.createProject', 'diff-insert')];
        }

        return [
            this.createTaskItem('Build', 'prustio.buildProject', 'gear'),
            this.createTaskItem('Upload', 'prustio.uploadProject', 'zap'),
            this.createTaskItem('Monitor', 'prustio.monitorProject', 'device-desktop'),
            this.createTaskItem('Clean', 'prustio.cleanProject', 'trash')
        ];
    }

    private createTaskItem(label: string, commandId: string, iconName: string): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        
        item.command = {
            command: commandId,
            title: label
        };
        
        item.iconPath = new vscode.ThemeIcon(iconName);
        
        return item;
    }
}