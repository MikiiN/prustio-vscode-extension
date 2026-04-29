import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as util from 'util';

// Convert exec from callback-style to Promise-style for cleaner async/await code
const execAsync = util.promisify(exec);

export class ToolWrapper {
    private workspaceRoot: string;

    /**
     * @param workspaceRoot The directory where PrustIO commands should be executed.
     */
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Runs upload target
     */
    public async upload(): Promise<string> {
        return this.runCommand('prustio run --target upload');
    }

    /**
     * Runs build target
     */
    public async build(): Promise<string> {
        return this.runCommand('prustio run --target build');
    }

    /**
     * Runs default target
     */
    public async run(): Promise<string> {
        return this.runCommand('prustio run');
    }

    /**
     * Runs build target
     */
    public async monitor(): Promise<string> {
        return this.runCommand('prustio device monitor');
    }

    /**
     * Core execution logic. 
     * Handles the actual child process and standardizes error throwing.
     */
    private async runCommand(command: string): Promise<string> {
        try {
            // Execute the command in the user's workspace directory
            const { stdout, stderr } = await execAsync(command, { cwd: this.workspaceRoot });
            
            // Note: Some CLIs write warnings or progress bars to stderr.
            // If PrustIO does this, you might want to log it instead of throwing.
            if (stderr && stderr.toLowerCase().includes('error')) {
                throw new Error(stderr);
            }

            return stdout.trim();
        } catch (error: any) {
            // Catch native Node errors (e.g., command not found) and format them safely
            const errorMessage = error.stderr || error.message || String(error);
            throw new Error(`PrustIO Error: ${errorMessage}`);
        }
    }
}