import { ExtensionContext, window, workspace } from 'vscode';
import { getTargetSolutionPaths, startCSharpLsServer } from '../cSharpLsServer';
import * as path from 'path';

export async function selectSolutionCommand(context: ExtensionContext) {
    try {
        console.log('Select solution command triggered');
        
        const solutions = await getTargetSolutionPaths();
        
        if (solutions.length === 0) {
            window.showWarningMessage('No solution files found in the workspace');
            return;
        }
        
        // Get the actual workspace folder(s)
        const workspaceFolders = workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 
            ? workspaceFolders[0].uri.fsPath 
            : '';
        
        console.log(`Workspace root: ${workspaceRoot}`);
        console.log(`Found solutions: ${solutions.join(', ')}`);
        
        // Show solution paths relative to workspace for better readability
        const solutionOptions = solutions.map(sln => {
            let displayPath = sln;
            
            // Try to make path relative to workspace
            if (workspaceRoot && sln.toLowerCase().startsWith(workspaceRoot.toLowerCase())) {
                displayPath = path.relative(workspaceRoot, sln);
            }
            
            // Extract just the filename
            const filename = path.basename(sln);
            
            // Get the directory containing the solution
            const directory = path.dirname(displayPath);
            
            return {
                label: filename,
                description: directory === '.' ? 'Root folder' : directory,
                detail: displayPath,
                path: sln // Keep full path
            };
        });

        const selection = await window.showQuickPick(solutionOptions, { 
            canPickMany: false,
            placeHolder: 'Select a solution file to load',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selection === undefined) {
            console.log('User cancelled solution selection');
            return;
        }

        console.log(`User selected solution: ${selection.path}`);
        await context.workspaceState.update('lastSolutionPathOrFolder', selection.path);

        window.showInformationMessage(`Loading solution: ${selection.label}...`);
        await startCSharpLsServer(context.extensionPath, selection.path);
    } catch (error) {
        console.error('Error in selectSolutionCommand:', error);
        window.showErrorMessage(`Failed to select solution: ${error}`);
    }
}
