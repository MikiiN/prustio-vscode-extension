import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Provides the data for the pRustIO tasks view in the sidebar.
 */
export class PrustioTaskProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /**
     * Refreshes the tasks view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Gets the tree item representation for a given element.
     * @param element The item to display in the tree.
     * @returns The corresponding vscode.TreeItem.
     */
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Gets the child elements for a specific tree item.
     * If no element is provided, it returns the root tasks.
     * @param element The parent item, or undefined for root elements.
     * @returns A promise that resolves to an array of child tree items.
     */
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

    /**
     * A helper method to create a single task item for the sidebar.
     * * @param label The text displayed for the item.
     * @param commandId The ID of the command to run when the item is clicked.
     * @param iconName The name of the icon to show next to the label.
     * @returns A configured vscode.TreeItem.
     */
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