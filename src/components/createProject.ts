import * as vscode from 'vscode';
import { ToolWrapper, PrustioBoard } from '../wrappers/toolWrapper';
import * as path from 'path';

/**
 * Represents a webview panel used to create a new pRustIO project.
 */
export class CreateProjectWebview {
   /**
     * The currently active webview panel, or undefined if none is open.
     */
    public static currentPanel: CreateProjectWebview | undefined;
   
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private defaultLocation: string;

    /**
     * Creates a new instance of the CreateProjectWebview.
     * @param panel The webview panel to use.
     * @param globalWrapper The tool wrapper used to interact with the CLI.
     * @param defaultLocation The default directory path for the new project.
     */
    private constructor(panel: vscode.WebviewPanel, private globalWrapper: ToolWrapper, defaultLocation: string) {
        this._panel = panel;
        this.defaultLocation = defaultLocation; 
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'browse':
                    const uri = await vscode.window.showOpenDialog({
                        canSelectFiles: false,
                        canSelectFolders: true,
                        canSelectMany: false,
                        openLabel: 'Select Project Location',
                        defaultUri: this.defaultLocation ? vscode.Uri.file(this.defaultLocation) : undefined
                    });
                    if (uri && uri[0]) {
                        // send the new path back to the webview
                        this._panel.webview.postMessage({ command: 'setPath', path: uri[0].fsPath });
                    }
                    return;
                case 'submit':
                    this.handleFormSubmit(message.data);
                    return;
            }
        }, null, this._disposables);
    }

    /**
     * Displays the webview panel. If it is already open, it brings it to the front.
     * @param globalWrapper The tool wrapper for CLI interactions.
     * @param defaultLocation The default directory path to suggest to the user.
     */
    public static async render(globalWrapper: ToolWrapper, defaultLocation: string = '') {
        if (CreateProjectWebview.currentPanel) {
            // update the location if user opens a different directory
            CreateProjectWebview.currentPanel.defaultLocation = defaultLocation;
            CreateProjectWebview.currentPanel._update();
            CreateProjectWebview.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'prustioCreateProject',
                'Create pRustIO Project',
                vscode.ViewColumn.One,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            CreateProjectWebview.currentPanel = new CreateProjectWebview(panel, globalWrapper, defaultLocation);
            await CreateProjectWebview.currentPanel._update();
        }
    }

    /**
     * Updates the content of the webview, including fetching the available boards.
     */
    private async _update() {
        const webview = this._panel.webview;
        
        webview.html = this._getHtmlForWebview("Fetching available boards...", [], true);

        try {
            const boards = await this.globalWrapper.getBoards();
            webview.html = this._getHtmlForWebview("", boards, false);
        } catch (error: any) {
            webview.html = this._getHtmlForWebview(`Failed to load boards: ${error.message}`, [], false);
        }
    }

    /**
     * Handles the form submission when the user clicks the create button.
     * @param data An object containing the project details provided by the user.
     */
    private async handleFormSubmit(data: { projectName: string, projectLocation: string, mode: string, boardId: string }) {
        const { projectName, projectLocation, mode, boardId } = data;
        
        if (!projectName || !projectLocation || !boardId) {
            vscode.window.showErrorMessage("All fields are required.");
            return;
        }
        const hybrid_flag = mode === "hybrid";

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating ${projectName}...`,
            cancellable: false
        }, async () => {
            try {
                await this.globalWrapper.init(projectLocation, projectName, hybrid_flag, boardId);
                vscode.window.showInformationMessage(`pRustIO: Project ${projectName} created successfully!`);
                const newWorkspaceUri = vscode.Uri.file(path.join(projectLocation, projectName));
                vscode.commands.executeCommand('vscode.openFolder', newWorkspaceUri);
                this.dispose(); 
            } catch (error: any) {
                vscode.window.showErrorMessage(`Initialization failed: ${error.message}`);
            }
        });
    }

    /**
     * Cleans up the webview resources when the panel is closed.
     */
    public dispose() {
        CreateProjectWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }

    /**
     * Generates the HTML content for the webview interface.
     * @param statusText The text to display as the current status.
     * @param boards An array of available boards to show in the dropdown list.
     * @param isLoading A boolean indicating if the data is still loading.
     * @returns A string containing the HTML markup.
     */
    private _getHtmlForWebview(statusText: string, boards: PrustioBoard[], isLoading: boolean) {
        const boardOptions = boards.map(b => 
            `<option value="${b.id}">${b.name} (${b.mcu})</option>`
        ).join('');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; max-width: 600px; margin: 0 auto; color: var(--vscode-editor-foreground); }
                    h2 { margin-bottom: 20px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 10px; }
                    .form-group { margin-bottom: 20px; }
                    label { display: block; margin-bottom: 8px; font-weight: 600; }
                    input, select {
                        width: 100%; padding: 8px; box-sizing: border-box;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        outline: none; border-radius: 2px;
                    }
                    input:focus, select:focus { border-color: var(--vscode-focusBorder); }
                    .flex { display: flex; gap: 10px; }
                    .flex input { flex: 1; }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none; padding: 8px 16px; cursor: pointer; border-radius: 2px;
                    }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                    .submit-btn { width: 100%; margin-top: 10px; font-size: 14px; padding: 10px; font-weight: bold; }
                    .status { color: var(--vscode-descriptionForeground); font-style: italic; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <h2>Create New pRustIO Project</h2>
                
                ${isLoading ? `<div class="status">${statusText}</div>` : ''}
                ${!isLoading && statusText ? `<div class="status" style="color: var(--vscode-errorForeground)">${statusText}</div>` : ''}

                <form id="projectForm" style="${isLoading ? 'display:none;' : 'display:block;'}">
                    <div class="form-group">
                        <label for="projectName">Project Name</label>
                        <input type="text" id="projectName" placeholder="e.g., blink_led" required autofocus />
                    </div>

                    <div class="form-group">
                        <label for="projectLocation">Location</label>
                        <div class="flex">
                            <input type="text" id="projectLocation" placeholder="Select a folder..." value="${this.defaultLocation}" readonly required />
                            <button type="button" id="browseBtn">Browse...</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="mode">Project Mode</label>
                        <select id="mode">
                            <option value="pure">Pure Rust</option>
                            <option value="hybrid">Hybrid (C/Rust)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="board">Target Board</label>
                        <select id="board" required>
                            <option value="" disabled selected>Select a board...</option>
                            ${boardOptions}
                        </select>
                    </div>

                    <button type="submit" class="submit-btn">Create Project</button>
                </form>

                <script>
                    const vscode = acquireVsCodeApi();

                    document.getElementById('browseBtn').addEventListener('click', () => {
                        vscode.postMessage({ command: 'browse' });
                    });

                    document.getElementById('projectForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        const data = {
                            projectName: document.getElementById('projectName').value,
                            projectLocation: document.getElementById('projectLocation').value,
                            mode: document.getElementById('mode').value,
                            boardId: document.getElementById('board').value
                        };
                        vscode.postMessage({ command: 'submit', data });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'setPath') {
                            document.getElementById('projectLocation').value = message.path;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}