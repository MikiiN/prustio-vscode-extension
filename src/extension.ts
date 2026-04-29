import * as vscode from 'vscode';
import { PrustioTaskProvider } from './components/sidebar';
import { CreateProjectWebview } from './components/createProject'; 
import { ToolWrapper } from './wrappers/toolWrapper';
import { EnvironmentManager } from './components/envManager';
import { exec } from 'child_process';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = util.promisify(exec);
let monitorTerminal: vscode.Terminal | undefined;
const workingDir = getCurrentlyOpenedDirectory();

export async function activate(context: vscode.ExtensionContext) {
    const isInstalled = await ensurePrustioInstalled();
    if (!isInstalled) {
        vscode.window.showErrorMessage("PrustIO extension cannot run without the CLI.");
        return; 
    }

    const taskProvider = new PrustioTaskProvider();
    vscode.window.registerTreeDataProvider('prustio-tasks-view', taskProvider);

    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/Prustio.toml');
    fileWatcher.onDidCreate(() => taskProvider.refresh());
    fileWatcher.onDidDelete(() => taskProvider.refresh());
    context.subscriptions.push(fileWatcher);

    const globalWrapper = new ToolWrapper(workingDir);

   let createCommand = vscode.commands.registerCommand('prustio.createProject', () => {
        // Find the currently opened directory (if any)
        let defaultLocation = (workingDir === undefined ? "" : workingDir);
        vscode.window.showInformationMessage(defaultLocation);

        // Open the HTML form and pass the default location!
        CreateProjectWebview.render(globalWrapper, defaultLocation);
    });

    context.subscriptions.push(createCommand);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const prustioWrapper = new ToolWrapper(workspaceRoot);

        const tomlPath = path.join(workspaceRoot, 'Prustio.toml');
         if (fs.existsSync(tomlPath)) {
             const envManager = new EnvironmentManager(context, workspaceRoot, prustioWrapper, fileWatcher);
             envManager.init();
         }


        const buildButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        buildButton.text = "$(gear) PrustIO Build"; 
        buildButton.tooltip = "Build the current PrustIO project";
        buildButton.command = 'prustio.buildProject';
        buildButton.show();
        context.subscriptions.push(buildButton);
        
        const runTaskWithProgress = async (taskName: string, taskFunction: () => Promise<string>) => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `PrustIO: ${taskName}...`,
                cancellable: false
            }, async () => {
                try {
                    await taskFunction();
                    vscode.window.showInformationMessage(`PrustIO: ${taskName} succeeded!`);
                } catch (error: any) {
                    vscode.window.showErrorMessage(error.message);
                }
            });
        };

        let buildCommand = vscode.commands.registerCommand('prustio.buildProject', () => { runTaskWithProgress("Building project", () => prustioWrapper.build()); });
        let uploadCommand = vscode.commands.registerCommand('prustio.uploadProject', () => { runTaskWithProgress("Uploading project", () => prustioWrapper.upload()); });
        let cleanCommand = vscode.commands.registerCommand('prustio.cleanProject', () => { runTaskWithProgress("Cleaning project", () => prustioWrapper.clean()); });

        let monitorCommand = vscode.commands.registerCommand('prustio.monitorProject', () => {
            if (!monitorTerminal) { 
                monitorTerminal = vscode.window.createTerminal("PrustIO Monitor");
            }
            monitorTerminal.show();
            monitorTerminal.sendText("prustio device monitor");
        });

        context.subscriptions.push(buildCommand, uploadCommand, monitorCommand, cleanCommand);

        vscode.window.onDidCloseTerminal(t => { 
            if (t === monitorTerminal) {
                monitorTerminal = undefined; 
            }
        });
    }
}

function getCurrentlyOpenedDirectory(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    // Check if at least one folder is open
    if (workspaceFolders && workspaceFolders.length > 0) {
        // Grab the first opened folder's file system path
        const currentDirectory = workspaceFolders[0].uri.fsPath;
        return currentDirectory;
    }
    // Return undefined if no folder is currently open
    return undefined;
}

async function ensurePrustioInstalled(): Promise<boolean> {
    try {
        await execAsync('prustio --version');
        return true; 
    } catch (error) {
        const response = await vscode.window.showInformationMessage(
            "The PrustIO CLI is missing. Would you like to install it now?",
            "Install", "Cancel"
        );

        if (response === "Install") {
            return await installPrustioCLI();
        }
        return false;
    }
}

async function installPrustioCLI(): Promise<boolean> {
    try {
        await execAsync('cargo --version');
    } catch {
        const response = await vscode.window.showErrorMessage(
            "Cargo is not installed. You need the Rust toolchain to install PrustIO.",
            "Get Rust (rustup.rs)", "Cancel"
        );

        if (response === "Get Rust (rustup.rs)") {
            vscode.env.openExternal(vscode.Uri.parse('https://rustup.rs/'));
        }
        return false; 
    }

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Installing PrustIO CLI...",
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: "Running 'cargo install prustio'..." });
            await execAsync('cargo install prustio');
            vscode.window.showInformationMessage("PrustIO CLI installed successfully!");
            return true;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to install CLI: ${error.message}`);
            return false;
        }
    });
}

export function deactivate() {
    if (monitorTerminal) {
        monitorTerminal.dispose();
    }
}