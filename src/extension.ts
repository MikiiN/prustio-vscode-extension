import * as vscode from 'vscode';
import { PrustioTaskProvider } from './components/sidebar';
import { ToolWrapper  } from './toolWrapper';
import { exec } from 'child_process';
import * as util from 'util';

let prustioTerminal: vscode.Terminal | undefined;
const execAsync = util.promisify(exec);

export async function activate(context: vscode.ExtensionContext) {

    const isInstalled = await ensurePrustioInstalled();
    
    if (!isInstalled) {
        vscode.window.showErrorMessage("PrustIO extension cannot run without the CLI.");
        return; // Stop activating the extension if installation failed
    }

    console.log('PrustIO extension is now active!');

    const buildButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    buildButton.text = "$(gear) PrustIO Build"; 
    buildButton.tooltip = "Build the current PrustIO project";
    buildButton.command = 'prustio.buildProject';
    buildButton.show();
    context.subscriptions.push(buildButton);

    const taskProvider = new PrustioTaskProvider();
    vscode.window.registerTreeDataProvider('prustio-tasks-view', taskProvider);
    
    // Build
    let buildCommand = vscode.commands.registerCommand('prustio.buildProject', () => {
        runInTerminal("prustio run -t build");
    });

    // Upload
    let uploadCommand = vscode.commands.registerCommand('prustio.uploadProject', () => {
        runInTerminal("prustio run -t upload");
    });

    // Monitor
    let monitorCommand = vscode.commands.registerCommand('prustio.monitorProject', () => {
        runInTerminal("prustio device monitor");
    });

    // Clean
    let cleanCommand = vscode.commands.registerCommand('prustio.cleanProject', () => {
        runInTerminal("prustio clean");
    });

    // push all commands to subscriptions so VS Code can clean them up later
    context.subscriptions.push(buildCommand, uploadCommand, monitorCommand, cleanCommand);
    
    // Listen for when the user manually clicks the trash can on the terminal
    vscode.window.onDidCloseTerminal(t => {
        if (t === prustioTerminal) {
            // Nullify our reference so the next command creates a fresh one
            prustioTerminal = undefined; 
        }
    });
}

/**
 * Checks if the CLI exists, and installs it if it doesn't.
 * @returns boolean indicating if the CLI is ready to use.
 */
async function ensurePrustioInstalled(): Promise<boolean> {
    try {
        // Test if the command exists by asking for its version
        await execAsync('prustio --version');
        return true; // It exists! No need to do anything.
        
    } catch (error) {
        // The command failed, which usually means it's not installed.
        // Let's ask the user if they want to install it.
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
 * Runs the installation command with a nice UI progress bar.
 */
async function installPrustioCLI(): Promise<boolean> {
    try {
        await execAsync('cargo --version');
    } catch {
        // Cargo is missing! Guide the user to install it.
        const response = await vscode.window.showErrorMessage(
            "Cargo is not installed. You need the Rust toolchain to install PrustIO.",
            "Get Rust (rustup.rs)", "Cancel"
        );

        if (response === "Get Rust (rustup.rs)") {
            // open web browser to the Rust installation page
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
            // Replace this with your actual installation command
            progress.report({ message: "Running 'cargo install prustio'..." });
            
            // This might take a minute, so we wait for the promise to resolve
            await execAsync('cargo install prustio');
            
            vscode.window.showInformationMessage("PrustIO CLI installed successfully!");
            return true;
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to install CLI: ${error.message}`);
            return false;
        }
    });
}

/**
 * Helper function to send commands to the PrustIO terminal.
 * Creates the terminal if it doesn't exist, brings it to the front, and runs the CLI.
 */
function runInTerminal(command: string) {
    if (!prustioTerminal) {
        prustioTerminal = vscode.window.createTerminal("PrustIO");
    }
    prustioTerminal.show(); 
    prustioTerminal.sendText(command);
}

export function deactivate() {
    // Cleanly dispose of the terminal when the extension shuts down
    if (prustioTerminal) {
        prustioTerminal.dispose();
    }
}