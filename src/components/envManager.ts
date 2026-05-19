import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolWrapper } from '../wrappers/toolWrapper';

export class EnvironmentManager {
    private envButton: vscode.StatusBarItem;
    private tomlPath: string;

    constructor(
        private context: vscode.ExtensionContext,
        private workspaceRoot: string,
        private prustioWrapper: ToolWrapper,
        private fileWatcher: vscode.FileSystemWatcher
    ) {
        this.tomlPath = path.join(this.workspaceRoot, 'Prustio.toml');
        
        this.envButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.envButton.command = 'prustio.selectEnvironment';
        this.envButton.tooltip = "Select PrustIO Environment";
        this.context.subscriptions.push(this.envButton);
    }

    public init() {
        let selectEnvCommand = vscode.commands.registerCommand('prustio.selectEnvironment', async () => {
            await this.handleSelectEnvironment();
        });
        this.context.subscriptions.push(selectEnvCommand);

        this.fileWatcher.onDidChange(() => this.syncEnvUI());
        this.fileWatcher.onDidCreate(() => this.syncEnvUI());
        this.fileWatcher.onDidDelete(() => this.syncEnvUI());

        this.syncEnvUI();
    }

    private syncEnvUI() {
        if (!fs.existsSync(this.tomlPath)) {
            this.envButton.hide();
            return;
        }

        const activeEnv = getActiveEnvFromToml(this.tomlPath);
        const envs = parseEnvironmentsFromToml(this.tomlPath);
        if (activeEnv) {
            if (envs.length === 0) {
                this.envButton.text = `$(symbol-event) PrustIO: No environment specified.`; 
                this.envButton.show();
            } else {
                this.envButton.text = `$(symbol-event) PrustIO: ${activeEnv}`;
                this.prustioWrapper.activateEnv(activeEnv); 
                this.envButton.show();
            }
        } else {
            this.envButton.text = `$(symbol-event) PrustIO: Select Env`;
            this.envButton.show();
        }
    }

    private async handleSelectEnvironment() {
        const envs = parseEnvironmentsFromToml(this.tomlPath);
        
        if (envs.length === 0) {
            vscode.window.showInformationMessage("No environments found in Prustio.toml.");
            return;
        }

        const activateEnv = getActiveEnvFromToml(this.tomlPath);

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = "pRustIO Environments";
        quickPick.placeholder = "Select active environment";

        const quickPickItems = envs.map(env => ({label: env}));
        quickPick.items = quickPickItems;

        if (activateEnv) {
            const itemToSelect = quickPickItems.find(item => item.label === activateEnv);
            if (itemToSelect) {
                quickPick.activeItems = [itemToSelect];
            }
        }

        quickPick.onDidAccept(() => {
            const selection = quickPick.selectedItems[0];
            const env = selection === undefined ? getActiveEnvFromToml(this.tomlPath) : selection.label;
            if (env === undefined) {
                vscode.window.showErrorMessage("No defined environment in the configuration file.");
            } else {
                this.prustioWrapper.activateEnv(env);
                vscode.window.setStatusBarMessage(`$(check) PrustIO: Environment changed to ${env}`, 3000);
            }
            quickPick.hide();
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
        });

        quickPick.show();
    }
}

//
// TOML helper functions
//

export function parseEnvironmentsFromToml(tomlPath: string): string[] {
    try {
        if (!fs.existsSync(tomlPath)) { 
            return [];
        }
        const content = fs.readFileSync(tomlPath, 'utf8');
        const envs: string[] = [];
        const envRegex = /^\[env\.([a-zA-Z0-9_-]+)\]/gm;
        let match;
        while ((match = envRegex.exec(content)) !== null) {
            envs.push(match[1]);
        }
        return envs;
    } catch { return []; }
}

export function getActiveEnvFromToml(tomlPath: string): string | undefined {
    try {
        if (!fs.existsSync(tomlPath)) {
            return undefined;
        }
        const content = fs.readFileSync(tomlPath, 'utf8');
        const match = content.match(/^active_env\s*=\s*"([^"]+)"/m);
        return match ? match[1] : undefined;
    } catch { return undefined; }
}