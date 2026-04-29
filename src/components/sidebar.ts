import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class PrustioTaskProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    
    // Create an event emitter so we can force the sidebar to refresh when the project is created
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Call this method to tell VS Code to redraw the sidebar
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (element) {
            return Promise.resolve([]); 
        } else {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            // Handle edge case: No folder is opened at all
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return this.getCreateNewProject();
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const tomlPath = path.join(workspaceRoot, 'Prustio.toml');

            // Check if it's a PrustIO project
            if (fs.existsSync(tomlPath)) {
                // It IS a project! Show operations.
                return Promise.resolve([
                    this.createTaskItem('Build', 'prustio.buildProject', 'gear'),
                    this.createTaskItem('Upload', 'prustio.uploadProject', 'zap'),
                    this.createTaskItem('Monitor', 'prustio.monitorProject', 'device-desktop'),
                    this.createTaskItem('Clean', 'prustio.cleanProject', 'trash')
                ]);
            } else {
                // It is NOT a project. Show creation option.
                return this.getCreateNewProject();
            }
        }
    }

    private getCreateNewProject() {
        return Promise.resolve([
            this.createTaskItem('Create New Project', 'prustio.createProject', 'diff-insert')
        ]);
    }

    private createTaskItem(label: string, commandId: string, iconName: string): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        
        if (commandId) {
            item.command = {
                command: commandId,
                title: label
            };
        }
        
        item.iconPath = new vscode.ThemeIcon(iconName);
        return item;
    }
}