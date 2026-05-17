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

    /**
     * @param workspaceRoot The directory where PrustIO commands should be executed.
     */
    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public async activateEnv(env_name: string): Promise<string> {
        const command = `prustio activate ${env_name}`;
        return this.runCommand(command);
    }
 
    /**
     * Runs init project
     */
    public async init(targetDir: string, name: string, hybrid_flag: boolean, board: string): Promise<string> {
        const command = hybrid_flag ? 
            `prustio project init "${name}" --hybrid --board "${board}"` : 
            `prustio project init "${name}" --board "${board}"`;
        return this.runCommand(command, targetDir); 
    }

    /**
     * Runs upload target
     */
    public async upload(): Promise<string> {
        return this.runCommand('prustio run -t upload');
    }

    /**
     * Runs build target
     */
    public async build(): Promise<string> {
        return this.runCommand('prustio run -t build');
    }

    /**
     * Runs default target
     */
    public async run(): Promise<string> {
        return this.runCommand('prustio run');
    }

    /**
     * Runs project clean
     */
    public async clean(): Promise<string> {
        return this.runCommand('prustio clean');
    }

    /**
     * Fetches the list of boards from the CLI
     */
    public async getBoards(): Promise<PrustioBoard[]> {
        const rawOutput = await this.runCommand('prustio boards --json-output'); 
        
        try {
            // Formatting
            const startIndex = rawOutput.indexOf('[');
            const endIndex = rawOutput.lastIndexOf(']');

            if (startIndex === -1 || endIndex === -1) {
                throw new Error("No JSON array brackets '[' or ']' found in the CLI output.");
            }

            // Ignoring any surrounding text/logs
            const cleanJsonString = rawOutput.substring(startIndex, endIndex + 1);

            const data: PrustioBoard[] = JSON.parse(cleanJsonString);
            return data;

        } catch (error: any) {
            // If it fails, throw an error showing exactly what it tried to parse
            // Mainly for debug
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
            // Determine where to run the command
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
}