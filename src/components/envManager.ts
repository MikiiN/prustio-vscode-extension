import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolWrapper } from '../wrappers/toolWrapper';

/**
 * Manages the pRustIO environment selection through the VS Code status bar.
 */
export class EnvironmentManager {
    private envButton: vscode.StatusBarItem;
    private tomlPath: string;

    /**
     * Creates a new EnvironmentManager instance.
     * @param context The extension context.
     * @param workspaceRoot The root path of the workspace.
     * @param prustioWrapper The tool wrapper to execute CLI commands.
     * @param fileWatcher The watcher that listens for changes in the Prustio.toml file.
     */
    constructor(
        private context: vscode.ExtensionContext,
        private workspaceRoot: string,
        private prustioWrapper: ToolWrapper,
        private fileWatcher: vscode.FileSystemWatcher
    ) {
        this.tomlPath = path.join(this.workspaceRoot, 'Prustio.toml');
        
        this.envButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.envButton.command = 'prustio.selectEnvironment';
        this.envButton.tooltip = "Select pRustIO Environment";
        this.context.subscriptions.push(this.envButton);
    }

    /**
     * Initializes the environment manager by registering commands and event listeners.
     */
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

    /**
     * Updates the status bar user interface based on the current Prustio.toml file.
     */
    private syncEnvUI() {
        if (!fs.existsSync(this.tomlPath)) {
            this.envButton.hide();
            return;
        }

        const activeEnv = getActiveEnvFromToml(this.tomlPath);
        const envs = parseEnvironmentsFromToml(this.tomlPath);
        if (activeEnv) {
            if (envs.length === 0) {
                this.envButton.text = `$(symbol-event) pRustIO: No environment specified.`; 
                this.envButton.show();
            } else {
                this.envButton.text = `$(symbol-event) pRustIO: ${activeEnv}`;
                this.prustioWrapper.activateEnv(activeEnv); 
                this.envButton.show();
            }
        } else {
            this.envButton.text = `$(symbol-event) pRustIO: Select Env`;
            this.envButton.show();
        }
    }

    /**
     * Handles the process of selecting an environment from a quick pick menu.
     */
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
                vscode.window.setStatusBarMessage(`$(check) pRustIO: Environment changed to ${env}`, 3000);
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

/**
 * Parses the available environments from the Prustio.toml file.
 * @param tomlPath The path to the Prustio.toml file.
 * @returns An array of environment names found in the file.
 */
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

/**
 * Retrieves the currently active environment from the Prustio.toml file.
 * @param tomlPath The path to the Prustio.toml file.
 * @returns The name of the active environment, or undefined if not found.
 */
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