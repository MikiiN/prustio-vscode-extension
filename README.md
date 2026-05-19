# VS Code extension pRustIO

Welcome to the **pRustIO** extension for Visual Studio Code! This extension helps you manage Rust embedded projects easily and efficiently.

This extension works as a graphic user interface for [pRustIO](https://github.com/MikiiN/prustio) CLI tool.

## Features

This extension provides a set of tools to work with the pRustIO Command Line Interface (CLI) directly inside your editor. 

* **Easy Project Creation:** Use the "Create New Project" command to open a visual setup screen. You can quickly configure your new project and select your target board.
* **Integrated Tasks:** Access common tasks from the "Project Tasks" view in the VS Code sidebar. 
* **Quick Build Button:** A convenient "pRustIO Build" button is available on the status bar at the bottom of your screen.
* **Device Monitor:** Open a terminal monitor to easily see the output from your connected device.
* **Automatic Setup:** If you do not have the pRustIO CLI installed, the extension will ask if you want to install it automatically using Cargo.

### Available Commands
You can find these commands in the Command Palette (`Ctrl+Shift+P`):
* `pRustIO: Create New Project` - Creates a new embedded project.
* `pRustIO: Build` - Compiles your project.
* `pRustIO: Upload` - Uploads the compiled project to your board.
* `pRustIO: Monitor` - Starts the device monitor.
* `pRustIO: Clean` - Removes generated build files.

## Requirements

To use this extension, you need to have the following tools installed:

1. **Rust Toolchain:** You must have Rust and Cargo installed on your system. You can download them from [rustup.rs](https://rustup.rs/).
2. **pRustIO CLI:** The extension needs the `prustio` command-line tool. If it is missing, the extension will help you install it.
3. **Rust Analyzer:** This extension requires the official `rust-analyzer` extension. It will be installed automatically when you install pRustIO.

## Extension Settings

Currently, this extension does not add any special settings to the VS Code settings menu. It works automatically when it finds out, the pRustIO project is opened.

## Release Notes

### 0.0.1
* Initial release of the pRustIO extension.
* Added support for project creation, building, uploading, and cleaning.
* Added automatic CLI installation and status bar integration.