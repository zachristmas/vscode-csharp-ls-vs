import {
    commands,
    ExtensionContext,
    Location,
    Position,
    Uri,
    window,
    workspace,
    Range,
} from "vscode";
import { selectSolutionCommand } from "./commands/selectSolution";
import { autostartCSharpLsServer, stopCSharpLsServer } from "./cSharpLsServer";

export async function activate(context: ExtensionContext) {
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

    await autostartCSharpLsServer(context);
}

export async function deactivate(): Promise<void> {
    await stopCSharpLsServer();
}
