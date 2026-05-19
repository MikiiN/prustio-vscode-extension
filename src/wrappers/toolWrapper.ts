import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as util from 'util';

// Convert exec from callback-style to Promise-style for cleaner async/await code
const execAsync = util.promisify(exec);

export interface PrustioBoard {
    id: string;
    mcu: string;
    platform: string;
    cargo_feature: string;
    bus_speed: number;
    upload_protocol: string;
    rustc_version: string;
    fcpu: number;
    ram: number;
    rom: number;
    name: string;
}

export class ToolWrapper {
    private workspaceRoot?: string;
    private prustioTerminal?: vscode.Terminal;

    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Runs active command
     */
    public async activateEnv(env_name: string): Promise<string> {
        const command = `prustio activate ${env_name}`;
        return this.runCommand(command);
    }
 
    /**
     * Runs init project command
     */
    public async init(targetDir: string, name: string, hybrid_flag: boolean, board: string): Promise<string> {
        const command = hybrid_flag ? 
            `prustio project init "${name}" --hybrid --board "${board}"` : 
            `prustio project init "${name}" --board "${board}"`;
        return this.runCommand(command, targetDir); 
    }

    /**
     * Runs upload target command
     */
    public async upload() {
        this.runCommandInTerminal('prustio run -t upload');
    }

    /**
     * Runs build target command
     */
    public async build() {
        this.runCommandInTerminal('prustio run -t build');
    }

    /**
     * Runs default target command
     */
    public async run() {
        this.runCommandInTerminal('prustio run');
    }

    /**
     * Runs project clean command
     */
    public async clean(): Promise<string> {
        return this.runCommand('prustio clean');
    }

    /**
     * Starts the device monitor in a VS Code terminal
     */
    public monitor() {
        this.runCommandInTerminal("prustio device monitor");
    }

    /**
     * Cleans up the terminal reference if the user closes it manually
     */
    public handleClosedTerminal(terminal: vscode.Terminal) {
        if (this.prustioTerminal === terminal) {
            this.prustioTerminal = undefined;
        }
    }

    /**
     * Disposes of the terminal when the extension deactivates
     */
    public dispose() {
        if (this.prustioTerminal) {
            this.prustioTerminal.dispose();
        }
    }

    /**
     * Fetches the list of boards from the CLI
     */
    public async getBoards(): Promise<PrustioBoard[]> {
        const rawOutput = await this.runCommand('prustio boards --json-output'); 
        
        try {
            // formatting
            const startIndex = rawOutput.indexOf('[');
            const endIndex = rawOutput.lastIndexOf(']');

            if (startIndex === -1 || endIndex === -1) {
                throw new Error("No JSON array brackets '[' or ']' found in the CLI output.");
            }

            // ignoring any surrounding text/logs
            const cleanJsonString = rawOutput.substring(startIndex, endIndex + 1);

            const data: PrustioBoard[] = JSON.parse(cleanJsonString);
            return data;

        } catch (error: any) {
            // if it fails, show the string
            // mainly for debug
            const preview = rawOutput.substring(0, 150).replace(/\n/g, "\\n"); 
            throw new Error(`Parse failed: ${error.message}. CLI Output preview: "${preview}..."`);
        }
    }

    /**
     * Core execution logic. 
     * Handles the actual child process and standardizes error throwing.
     */
    private async runCommand(command: string, customCwd?: string): Promise<string> {
        try {
            // determine where to run the command
            const cwd = customCwd || this.workspaceRoot;
            const options = cwd ? { cwd } : {};

            const { stdout, stderr } = await execAsync(command, options);
            
            if (stderr && stderr.toLowerCase().includes('error')) {
                throw new Error(stderr);
            }

            return stdout.trim();
        } catch (error: any) {
            const errorMessage = error.stderr || error.message || String(error);
            throw new Error(`PrustIO Error: ${errorMessage}`);
        }
    }

    private runCommandInTerminal(command: string) {
        if (!this.prustioTerminal) {
            this.prustioTerminal = vscode.window.createTerminal("PrustIO");
        }
        this.prustioTerminal.show();
        this.prustioTerminal.sendText(command);
    }
}