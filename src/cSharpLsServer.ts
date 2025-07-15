import { existsSync } from 'fs';
import * as path from 'path';
import { mkdir } from 'fs/promises';
import { readdir } from 'fs/promises';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { ChildProcess, spawn } from 'child_process';
import { ExtensionContext, workspace, window, commands, TextDocumentContentProvider, Uri } from 'vscode';
import { csharpLsVersion } from './constants/csharpLsVersion';

let client: LanguageClient | undefined = undefined;

export function isServerRunning(): boolean {
    return client !== undefined && client.state === 2; // 2 = Running state
}

export async function startCSharpLsServer(
    extensionPath: string,
    solutionPath: string,
): Promise<void> {
    try {
        console.log(`Starting C# Language Server for solution: ${solutionPath}`);
        
        // Verify the solution file exists
        if (!existsSync(solutionPath)) {
            throw new Error(`Solution file not found: ${solutionPath}`);
        }
        
        await stopCSharpLsServer();

        await ensureWeHaveDotnet();

        const csharpLsBinaryPath = await resolveCsharpLsBinaryPath(extensionPath);
        console.log(`Using C# Language Server binary: ${csharpLsBinaryPath}`);

        // Find the workspace folder that contains the solution
        const slnWorkspaceFolder = workspace.workspaceFolders?.find(f => 
            solutionPath.toLowerCase().startsWith(f.uri.fsPath.toLowerCase())
        );
        
        // Determine the root path - prefer the folder containing the solution
        let rootPath = '';
        if (slnWorkspaceFolder) {
            rootPath = slnWorkspaceFolder.uri.fsPath;
        } else if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
            // Fallback to first workspace folder
            rootPath = workspace.workspaceFolders[0].uri.fsPath;
            console.warn(`Solution ${solutionPath} is not in any workspace folder, using first workspace folder as root`);
        } else {
            // Last resort - use the directory containing the solution
            rootPath = path.dirname(solutionPath);
            console.warn(`No workspace folders found, using solution directory as root: ${rootPath}`);
        }

        // Calculate relative path
        let relativeSolutionPath = solutionPath;
        if (rootPath) {
            relativeSolutionPath = path.relative(rootPath, solutionPath);
            // If the relative path starts with .., the solution is outside the root
            if (relativeSolutionPath.startsWith('..')) {
                console.warn(`Solution is outside the workspace root, using absolute path`);
                relativeSolutionPath = solutionPath;
            }
        }

        console.log(`Root path: ${rootPath}`);
        console.log(`Solution path: ${solutionPath}`);
        console.log(`Relative solution path: ${relativeSolutionPath}`);

        // Build command line arguments
        const args = [`--solution`, relativeSolutionPath];

        // Add MSBuild configuration if provided
        const msbuildPath = workspace.getConfiguration('csharp-ls').get('msbuild.path') as string;
        const msbuildExecutable = workspace.getConfiguration('csharp-ls').get('msbuild.executable') as string;

        if (msbuildExecutable && msbuildExecutable.trim() !== '') {
            args.push('--msbuildexepath');
            args.push(msbuildExecutable.trim());
            console.log(`Using MSBuild executable: ${msbuildExecutable.trim()}`);
        } else if (msbuildPath && msbuildPath.trim() !== '') {
            args.push('--msbuildpath');
            args.push(msbuildPath.trim());
            console.log(`Using MSBuild path: ${msbuildPath.trim()}`);
        }

        const csharpLsExecutable = {
            command: csharpLsBinaryPath,
            args: args,
            options: {
                cwd: rootPath,
            },
        };

        const serverOptions: ServerOptions = {
            run: csharpLsExecutable,
            debug: csharpLsExecutable,
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'csharp' }],
            synchronize: {
                fileEvents: workspace.createFileSystemWatcher('**/.{cs,csproj}')
            }
        };

        client = new LanguageClient(
            'csharp-ls',
            'csharp-ls',
            serverOptions,
            clientOptions
        );

        registerTextDocumentContentProviders();

        console.log('Starting language client...');
        await client.start();
        console.log('C# Language Server started successfully');
        
        window.showInformationMessage(`C# Language Server started for ${path.basename(solutionPath)}`);
    } catch (error) {
        console.error('Failed to start C# Language Server:', error);
        window.showErrorMessage(`Failed to start C# Language Server: ${error}`);
        throw error;
    }
}

export async function stopCSharpLsServer(): Promise<void> {
    if (!client) {
        return;
    }

    await client.stop();
    client = undefined;
}

export async function findSolutionForFile(filePath: string): Promise<string | undefined> {
    console.log(`Finding solution for file: ${filePath}`);
    
    // Start from the file's directory and walk up
    let currentDir = path.dirname(filePath);
    const rootDir = path.parse(currentDir).root;
    
    // First, look for solution files in parent directories
    while (currentDir !== rootDir) {
        try {
            const files = await readdir(currentDir);
            
            // Check for .sln or .slnx files
            const solutionFile = files.find(f => f.endsWith('.sln') || f.endsWith('.slnx'));
            if (solutionFile) {
                const solutionPath = path.join(currentDir, solutionFile);
                console.log(`Found solution: ${solutionPath}`);
                return solutionPath;
            }
            
            // Move up one directory
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break; // Reached the root
            }
            currentDir = parentDir;
        } catch (error) {
            console.error(`Error reading directory ${currentDir}:`, error);
            break;
        }
    }
    
    // If no solution found in parent directories, search the workspace
    const allSolutions = await getTargetSolutionPaths();
    if (allSolutions.length === 1) {
        console.log(`Found single solution in workspace: ${allSolutions[0]}`);
        return allSolutions[0];
    } else if (allSolutions.length > 1) {
        // Try to find the solution that's closest to the file
        let closestSolution: string | undefined;
        let shortestDistance = Infinity;
        
        for (const solution of allSolutions) {
            const solutionDir = path.dirname(solution);
            if (filePath.toLowerCase().startsWith(solutionDir.toLowerCase())) {
                const distance = filePath.length - solutionDir.length;
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    closestSolution = solution;
                }
            }
        }
        
        if (closestSolution) {
            console.log(`Found closest solution: ${closestSolution}`);
            return closestSolution;
        }
    }
    
    console.log('No solution found for file');
    return undefined;
}

export async function getTargetSolutionPaths(): Promise<string[]> {
    console.log('Searching for solution files...');
    
    const solutionFiles = await workspace.findFiles(
        '{**/*.sln,**/*.slnx}',
        '{**/node_modules/**,**/.git/**,**/.vs/**,**/bin/**,**/obj/**}');

    console.log(`Found ${solutionFiles.length} solution file(s) from workspace.findFiles`);

    // Create a map to track unique solutions by their normalized paths
    const uniqueSolutions = new Map<string, string>();
    
    solutionFiles.forEach(f => {
        let filePath = f.fsPath;  // Use fsPath instead of path for correct file system path
        
        // Normalize the path for comparison
        const normalizedPath = path.resolve(filePath).toLowerCase().replace(/\\/g, '/');
        
        // Only add if we haven't seen this normalized path before
        if (!uniqueSolutions.has(normalizedPath)) {
            uniqueSolutions.set(normalizedPath, filePath);
            console.log(`  - ${filePath}`);
        }
    });
    
    // Return the original paths (not normalized) to preserve user's path format
    return Array.from(uniqueSolutions.values());
}

export async function autostartCSharpLsServer(context: ExtensionContext): Promise<void> {
    try {
        const previousSolution = await context.workspaceState.get('lastSolutionPathOrFolder') as string;

        if (previousSolution) {
            console.log(`Starting language server with previous solution: ${previousSolution}`);
            await startCSharpLsServer(context.extensionPath, previousSolution);
            return;
        }

        const targetSolutions = await getTargetSolutionPaths();
        console.log(`Found ${targetSolutions.length} solution(s)`);

        if (targetSolutions.length === 0) {
            console.log('No solution files found in workspace');
            // Don't show error - user might open C# files later
            return;
        }

        if (targetSolutions.length === 1) {
            console.log(`Starting language server with single solution: ${targetSolutions[0]}`);
            await startCSharpLsServer(context.extensionPath, targetSolutions[0]);
            return;
        }

        if (targetSolutions.length > 1) {
            console.log('Multiple solutions detected, prompting user to select');
            // Use setTimeout to ensure extension is fully activated before showing message
            setTimeout(async () => {
                const selectSolution = await window.showInformationMessage(
                    `Found ${targetSolutions.length} solution files. Please select which one to use.`, 
                    'Select solution'
                );

                if (selectSolution) {
                    // Directly call the command implementation instead of executing command
                    // This avoids potential activation issues
                    const { selectSolutionCommand } = await import('./commands/selectSolution');
                    await selectSolutionCommand(context);
                }
            }, 100); // Small delay to ensure extension is ready
        }
    } catch (error) {
        console.error('Error in autostartCSharpLsServer:', error);
        window.showErrorMessage(`Failed to auto-start C# Language Server: ${error}`);
    }
}

function shellExec(command: string, args: string[], cwd: string): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, reject) => {
        let childprocess: ChildProcess;
        try {
            childprocess = spawn(command, args, { cwd });
        }
        catch (e) {
            console.error(`shellExec: '${command}' error: '${e}'`);
            return reject(String(e));
        }

        childprocess.stderr!.on('data', function (error: any) {
            console.error('spawn', command, args, cwd, error.toString());
            reject(error.toString());
        });

        let stdout = '';
        childprocess.stdout!.on('data', (data: any) => {
            stdout += data.toString();
        });

        childprocess.stdout!.on('close', () => {
            resolve(stdout);
        });
    });
}

async function ensureWeHaveDotnet() {
    let dotnetVersion = '';

    try {
        console.log('Checking for .NET installation...');
        dotnetVersion = await shellExec('dotnet', ['--version'], '') ?? '';
        dotnetVersion = dotnetVersion.trim();
        console.log(`Found .NET version: ${dotnetVersion}`);
    }
    catch (e) {
        console.error(`Failed to get dotnet version: ${e}`);
        throw new Error(`Failed to get .NET version. Make sure .NET SDK is installed and available in PATH. Error: ${e}`);
    }

    if (!dotnetVersion) {
        throw new Error('Failed to get .NET version. Make sure .NET SDK is installed and available in PATH');
    }

    const dotnetVersionParts = dotnetVersion.split('.');
    const majorVersion = parseInt(dotnetVersionParts[0]);

    if (isNaN(majorVersion)) {
        throw new Error(`Failed to parse .NET version: ${dotnetVersion}`);
    }

    if (majorVersion < 8) {
        throw new Error(`csharp-ls requires .NET SDK version 8.0 or higher. Current version is ${dotnetVersion}. Please install .NET 8.0 SDK from https://dotnet.microsoft.com/download`);
    }
}

async function resolveCsharpLsBinaryPath(extensionPath: string,) {
    const devCsharpLsBinaryPath = workspace.getConfiguration('csharp-ls').get('csharp-ls-executable') as string;

    if (devCsharpLsBinaryPath) {
        return devCsharpLsBinaryPath;
    }

    const csharpLsRootPath = path.resolve(extensionPath, `.csharp-ls-vs.${csharpLsVersion}`);

    if (!existsSync(csharpLsRootPath)) {
        await mkdir(csharpLsRootPath, { recursive: true });
    }

    const csharpLsBinaryPath = path.resolve(csharpLsRootPath, 'csharp-ls-vs');

    if (!existsSync(csharpLsBinaryPath)) {

        const installArgs = [
            'tool',
            'install',
            'csharp-ls-vs',
            '--tool-path', csharpLsRootPath,
            '--version', csharpLsVersion,
        ];

        try {
            await shellExec('dotnet', installArgs, csharpLsRootPath);
        }
        catch (e) {
            window.showErrorMessage(`Failed to install csharp-ls-vs: ${e}`);
            throw new Error('Failed to install csharp-ls-vs');
        }
    }

    return csharpLsBinaryPath;
}

function registerTextDocumentContentProviders() {
    interface CSharpMetadataResponse {
        projectName: string;
        assemblyName: string;
        symbolName: string;
        source: string;
    }

    const csharpMetadataProvider = new (class implements TextDocumentContentProvider {
        async provideTextDocumentContent(uri: Uri): Promise<string> {
            const response = await client?.sendRequest<CSharpMetadataResponse>('csharp/metadata', {
                textDocument: {
                    uri: uri.toString(),
                }
            });

            return response?.source ?? '';
        }
      })();

    workspace.registerTextDocumentContentProvider('csharp', csharpMetadataProvider);
}
