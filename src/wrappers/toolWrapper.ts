import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as util from 'util';

// Convert exec from callback-style to Promise-style for cleaner async/await code
const execAsync = util.promisify(exec);

/**
 * Represents a board configuration supported by PrustIO.
 */
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

/**
 * A wrapper class for interacting with the PrustIO Command Line Interface (CLI).
 */
export class ToolWrapper {
    private workspaceRoot?: string;
    private prustioTerminal?: vscode.Terminal;

    /**
     * Creates a new ToolWrapper instance.
     * @param workspaceRoot The root path of the current workspace.
     */
    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Activates a specific environment for the project.
     * @param env_name The name of the environment to activate.
     * @returns A promise that resolves to the CLI output.
     */
    public async activateEnv(env_name: string): Promise<string> {
        const command = `prustio activate ${env_name} --json-output`;
        return this.runCommand(command);
    }
 
    /**
     * Initializes a new PrustIO project.
     * * @param targetDir The directory where the project will be created.
     * @param name The name of the new project.
     * @param hybrid_flag A boolean indicating if it is a hybrid project (C and Rust).
     * @param board The ID of the target board.
     * @returns A promise that resolves to the CLI output.
     */
    public async init(targetDir: string, name: string, hybrid_flag: boolean, board: string): Promise<string> {
        const command = hybrid_flag ? 
            `prustio project init "${name}" --hybrid --board ${board} --json-output` : 
            `prustio project init "${name}" --board ${board}  --json-output`;
        return this.runCommand(command, targetDir); 
    }

    /**
     * Uploads the compiled project to the target board.
     */
    public async upload() {
        this.runCommandInTerminal('prustio run -t upload');
    }

    /**
     * Builds the active project.
     */
    public async build() {
        this.runCommandInTerminal('prustio run -t build');
    }

    /**
     * Runs the default target command for the project.
     */
    public async run() {
        this.runCommandInTerminal('prustio run');
    }

    /**
     * Runs project clean command
     */
    public async clean(): Promise<string> {
        return this.runCommand('prustio clean  --json-output');
    }

    /**
     * Cleans the project by removing generated build files.
     * @returns A promise that resolves to the CLI output.
     */
    public monitor() {
        this.runCommandInTerminal("prustio device monitor");
    }

    /**
     * Cleans up the terminal reference if the user closes it manually.
     * @param terminal The terminal that was closed.
     */
    public handleClosedTerminal(terminal: vscode.Terminal) {
        if (this.prustioTerminal === terminal) {
            this.prustioTerminal = undefined;
        }
    }

    /**
     * Disposes of the terminal when the extension is deactivated.
     */
    public dispose() {
        if (this.prustioTerminal) {
            this.prustioTerminal.dispose();
        }
    }

    /**
     * Gets the list of available boards from the PrustIO CLI.
     * @returns A promise that resolves to an array of PrustioBoard objects.
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
     * Executes a CLI command and handles the process standard output and errors.
     * @param command The command to execute.
     * @param customCwd An optional custom working directory.
     * @returns A promise that resolves to the standard output of the command.
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
            const parsedJson = JSON.parse(error.stdout);
            let finalErrorMessage = parsedJson.message;

            throw new Error(`PrustIO Error: ${finalErrorMessage}`);
        }
    }

    /**
     * Runs a CLI command inside a dedicated VS Code terminal.
     * @param command The command to run.
     */
    private runCommandInTerminal(command: string) {
        if (!this.prustioTerminal) {
            this.prustioTerminal = vscode.window.createTerminal("PrustIO");
        }
        this.prustioTerminal.show();
        this.prustioTerminal.sendText(command);
    }
}