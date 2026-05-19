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
const workingDir = getCurrentlyOpenedDirectory();

let activeProjectWrapper: ToolWrapper | undefined;

export async function activate(context: vscode.ExtensionContext) {
    // initial pRustIO validation
    if (!(await ensurePrustioInstalled())) {
        vscode.window.showErrorMessage("PrustIO extension cannot run without the CLI.");
        return; 
    }

    // setup UI and watchers
    const taskProvider = new PrustioTaskProvider();
    vscode.window.registerTreeDataProvider('prustio-tasks-view', taskProvider);

    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/Prustio.toml');
    fileWatcher.onDidCreate(() => taskProvider.refresh());
    fileWatcher.onDidDelete(() => taskProvider.refresh());
    context.subscriptions.push(fileWatcher);

    // setup project creation command
    const projectCreationWrapper = new ToolWrapper(workingDir);
    context.subscriptions.push(vscode.commands.registerCommand('prustio.createProject', () => {
        let defaultLocation = workingDir ?? "";
        vscode.window.showInformationMessage(defaultLocation);
        CreateProjectWebview.render(projectCreationWrapper, defaultLocation);
    }));

    // setup active workspace commands
    const workspaceRoot = workingDir; 
    if (workspaceRoot) {
        activeProjectWrapper = new ToolWrapper(workspaceRoot);

        // initialize environment manager if Prustio.toml exists
        if (fs.existsSync(path.join(workspaceRoot, 'Prustio.toml'))) {
             new EnvironmentManager(context, workspaceRoot, activeProjectWrapper, fileWatcher).init();
        }

        setupStatusBar(context);
        registerWorkspaceCommands(context, activeProjectWrapper);
    }
}

/**
 * Registers project-specific commands elegantly and delegates to ToolWrapper
 */
function registerWorkspaceCommands(context: vscode.ExtensionContext, wrapper: ToolWrapper) {
    const tasks = [
        { id: 'prustio.buildProject', action: () => wrapper.build() },
        { id: 'prustio.uploadProject', action: () => wrapper.upload() },
        { id: 'prustio.monitorProject', action: () => wrapper.monitor() },
    ];

    tasks.forEach(task => {
        context.subscriptions.push(
            vscode.commands.registerCommand(task.id, () => task.action())
        );
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('prustio.cleanProject', () => runTaskWithProgress(
            "Cleaning project",
            () => wrapper.clean()
        ))
    );

    // setup terminal cleanup
    vscode.window.onDidCloseTerminal(t => wrapper.handleClosedTerminal(t));
}

/**
 * Configure status bar to contain the build button and environment manager.
 */
function setupStatusBar(context: vscode.ExtensionContext) {
    const buildButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    buildButton.text = "$(gear) PrustIO Build"; 
    buildButton.tooltip = "Build the current PrustIO project";
    buildButton.command = 'prustio.buildProject';
    buildButton.show();
    context.subscriptions.push(buildButton);
}

/**
 * Show progress on executed tasks.
 */
async function runTaskWithProgress(taskName: string, taskFunction: () => Promise<string>) {
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
}

/**
 * Retrieve currently opened directory path.
 */
function getCurrentlyOpenedDirectory(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    // check if at least one directory is open
    if (workspaceFolders && workspaceFolders.length > 0) {
        // grab the first opened directory file system path
        const currentDirectory = workspaceFolders[0].uri.fsPath;
        return currentDirectory;
    }

    return undefined;
}

/**
 * Check if pRustIO CLI is installed and if not try to install it.
 */
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

/**
 * Install pRustIO CLI tool.
 */
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
    activeProjectWrapper?.dispose();
}