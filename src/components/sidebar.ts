import * as vscode from 'vscode';

// The TreeDataProvider is VS Code's interface for building sidebar lists
export class PrustioTaskProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    
    // Required method: returns the actual item to be rendered in the UI
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    // Required method: returns the list of children for a given element.
    // If element is undefined, it means we are at the root level of the sidebar.
    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (element) {
            // We don't have nested folders in our list right now, so return empty
            return Promise.resolve([]); 
        } else {
            // Return our root list of PrustIO commands
            return Promise.resolve([
                this.createTaskItem('Build', 'prustio.buildProject', 'gear'),
                this.createTaskItem('Upload', 'prustio.uploadProject', 'zap'),
                this.createTaskItem('Monitor', 'prustio.monitorProject', 'device-desktop'),
                this.createTaskItem('Clean', 'prustio.cleanProject', 'trash')
            ]);
        }
    }

    // A helper method to easily create clean, clickable items with icons
    private createTaskItem(label: string, commandId: string, iconName: string): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        
        // Tie the UI item to the command ID we register in extension.ts
        item.command = {
            command: commandId,
            title: label
        };
        
        // Use built-in VS Code icons (Product Icon Reference)
        item.iconPath = new vscode.ThemeIcon(iconName);
        
        return item;
    }
}