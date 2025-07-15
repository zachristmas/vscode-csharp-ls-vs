import {
    commands,
    ExtensionContext,
    Location,
    Position,
    Uri,
    window,
    workspace,
    Range,
    TextDocument,
} from "vscode";
import { selectSolutionCommand } from "./commands/selectSolution";
import { autostartCSharpLsServer, stopCSharpLsServer, startCSharpLsServer, isServerRunning, findSolutionForFile } from "./cSharpLsServer";

export async function activate(context: ExtensionContext) {
    console.log('csharp-ls-vs extension is activating...');
    
    try {
        const selectSolutionDisposable = commands
            .registerCommand('csharp-ls.selectSolution', () => selectSolutionCommand(context));

        // Register command for showing references from CodeLens
        const showReferencesDisposable = commands.registerCommand('csharp-ls.showReferences', async (...args: any[]) => {
            console.log('csharp-ls.showReferences called with args:', args);
            
            if (!args || args.length === 0) {
                console.log('No arguments provided');
                return;
            }
            
            try {
                // The first argument should be our serialized ReferenceParams
                const arg = args[0];
                console.log('First argument:', arg);
                console.log('Argument type:', typeof arg);
                
                const params = typeof arg === 'string' ? JSON.parse(arg) : arg;
                console.log('Parsed params:', params);
                
                if (params && params.textDocument && params.position) {
                    const uri = Uri.parse(params.textDocument.uri);
                    const position = new Position(params.position.line, params.position.character);
                    
                    console.log('Finding references for:', {
                        uri: uri.toString(),
                        position: position
                    });
                    
                    // Use the built-in references provider through VS Code
                    const locations = await commands.executeCommand<Location[]>(
                        'vscode.executeReferenceProvider',
                        uri,
                        position
                    );
                    
                    if (locations && locations.length > 0) {
                        console.log(`Found ${locations.length} references`);
                        
                        // Show references using VS Code's built-in command
                        await commands.executeCommand(
                            'editor.action.showReferences',
                            uri,
                            position,
                            locations
                        );
                    } else {
                        window.showInformationMessage('No references found');
                    }
                } else {
                    console.error('Invalid params structure:', params);
                }
            } catch (error) {
                console.error('Error showing references:', error);
                window.showErrorMessage(`Error showing references: ${error}`);
            }
        });

        context.subscriptions.push(selectSolutionDisposable);
        context.subscriptions.push(showReferencesDisposable);

        // Register restart server command
        const restartServerDisposable = commands.registerCommand('csharp-ls.restartServer', async () => {
            try {
                console.log('Restarting C# Language Server...');
                const lastSolution = await context.workspaceState.get('lastSolutionPathOrFolder') as string;
                
                if (lastSolution) {
                    await stopCSharpLsServer();
                    await startCSharpLsServer(context.extensionPath, lastSolution);
                    window.showInformationMessage('C# Language Server restarted successfully');
                } else {
                    // No previous solution, prompt to select
                    await selectSolutionCommand(context);
                }
            } catch (error) {
                console.error('Failed to restart C# Language Server:', error);
                window.showErrorMessage(`Failed to restart C# Language Server: ${error}`);
            }
        });
        context.subscriptions.push(restartServerDisposable);

        // Listen for when C# documents are opened
        const onDidOpenTextDocument = workspace.onDidOpenTextDocument(async (document: TextDocument) => {
            // Check if it's a C# file
            if (document.languageId !== 'csharp') {
                return;
            }
            
            // Check if server is already running
            if (isServerRunning()) {
                return;
            }
            
            console.log(`C# document opened: ${document.uri.fsPath}`);
            
            // Try to find and load the solution for this file
            const solution = await findSolutionForFile(document.uri.fsPath);
            if (solution) {
                console.log(`Auto-loading solution for opened file: ${solution}`);
                await context.workspaceState.update('lastSolutionPathOrFolder', solution);
                await startCSharpLsServer(context.extensionPath, solution);
            } else {
                // If no solution found, prompt user to select one
                const selectSolution = await window.showInformationMessage(
                    'No solution found for this C# file. Would you like to select a solution?',
                    'Select solution'
                );
                
                if (selectSolution) {
                    await selectSolutionCommand(context);
                }
            }
        });
        context.subscriptions.push(onDidOpenTextDocument);

        // Also check if there's already an active C# document when the extension activates
        if (window.activeTextEditor && window.activeTextEditor.document.languageId === 'csharp') {
            const document = window.activeTextEditor.document;
            if (!isServerRunning()) {
                console.log('Active C# document found on activation, trying to find solution...');
                const solution = await findSolutionForFile(document.uri.fsPath);
                if (solution) {
                    await context.workspaceState.update('lastSolutionPathOrFolder', solution);
                    await startCSharpLsServer(context.extensionPath, solution);
                    return; // Skip the normal autostart process
                }
            }
        }

        console.log('csharp-ls-vs extension commands registered, starting auto-start process...');
        
        // Add a small delay to ensure VS Code has finished indexing the folder
        // This is especially important when opening a folder for the first time
        setTimeout(async () => {
            await autostartCSharpLsServer(context);
        }, 500);
        
        console.log('csharp-ls-vs extension activated successfully');
    } catch (error) {
        console.error('Failed to activate csharp-ls-vs extension:', error);
        window.showErrorMessage(`Failed to activate C# Language Server extension: ${error}`);
    }
}

export async function deactivate(): Promise<void> {
    await stopCSharpLsServer();
}
