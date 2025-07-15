import { existsSync } from 'fs';
import * as path from 'path';
import { mkdir } from 'fs/promises';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { ChildProcess, spawn } from 'child_process';
import { ExtensionContext, workspace, window, commands, TextDocumentContentProvider, Uri } from 'vscode';
import { csharpLsVersion } from './constants/csharpLsVersion';

let client: LanguageClient | undefined = undefined;

export async function startCSharpLsServer(
    extensionPath: string,
    solutionPath: string,
): Promise<void> {
    await stopCSharpLsServer();

    await ensureWeHaveDotnet();

    const csharpLsBinaryPath = await resolveCsharpLsBinaryPath(extensionPath);

    const slnWorkspaceFolder = workspace.workspaceFolders?.find(f => solutionPath.startsWith(f.uri.fsPath));
    const rootPath = slnWorkspaceFolder?.uri.fsPath ?? workspace.rootPath ?? '';
    const relativeSolutionPath = solutionPath.replace(rootPath, '').replace(/^[\/\\]/, '');

    // Build command line arguments
    const args = [`--solution`, relativeSolutionPath];

    // Add MSBuild configuration if provided
    const msbuildPath = workspace.getConfiguration('csharp-ls').get('msbuild.path') as string;
    const msbuildExecutable = workspace.getConfiguration('csharp-ls').get('msbuild.executable') as string;

    if (msbuildExecutable && msbuildExecutable.trim() !== '') {
        args.push('--msbuildexepath');
        args.push(msbuildExecutable.trim());
    } else if (msbuildPath && msbuildPath.trim() !== '') {
        args.push('--msbuildpath');
        args.push(msbuildPath.trim());
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

    client.start();
}

export async function stopCSharpLsServer(): Promise<void> {
    if (!client) {
        return;
    }

    await client.stop();
    client = undefined;
}

export async function getTargetSolutionPaths(): Promise<string[]> {
    const solutionFiles = await workspace.findFiles(
        '{**/*.sln,**/*.slnx}',
        '{**/node_modules/**,**/.git/**}');

    // Normalize paths and remove duplicates
    const normalizedPaths = solutionFiles.map(f => {
        let filePath = f.path;
        // Convert VS Code URI path format to standard path
        if (filePath.startsWith('/') && filePath.includes(':')) {
            // Convert /c:/path to c:/path on Windows
            filePath = filePath.substring(1);
        }
        return path.resolve(filePath).toLowerCase().replace(/\//g, '\\');
    });

    // Remove duplicates by using Set
    const uniquePaths = [...new Set(normalizedPaths)];
    
    // Map back to original paths for the unique ones
    const uniqueOriginalPaths = uniquePaths.map(normalizedPath => {
        const originalFile = solutionFiles.find(f => {
            let filePath = f.path;
            if (filePath.startsWith('/') && filePath.includes(':')) {
                filePath = filePath.substring(1);
            }
            return path.resolve(filePath).toLowerCase().replace(/\//g, '\\') === normalizedPath;
        });
        return originalFile?.path || normalizedPath;
    });

    return uniqueOriginalPaths;
}

export async function autostartCSharpLsServer(context: ExtensionContext): Promise<void> {
    const previousSolution = await context.workspaceState.get('lastSolutionPathOrFolder') as string;

    if (previousSolution) {
        await startCSharpLsServer(context.extensionPath, previousSolution);
        return;
    }

    const targetSolutions = await getTargetSolutionPaths();

    if (targetSolutions.length === 1) {
        await startCSharpLsServer(context.extensionPath, targetSolutions[0]);
        return;
    }

    if (targetSolutions.length > 1) {
        const selectSolution = await window.showInformationMessage('More than one solution detected', 'Select solution');

        if (selectSolution) {
            commands.executeCommand('csharp-ls.selectSolution');
            return;
        }
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
        dotnetVersion = await shellExec('dotnet', ['--version'], '') ?? '';
    }
    catch (e) {
        console.error(`Failed to get dotnet version: ${e}`);
    }

    if (!dotnetVersion) {
        throw new Error('Failed to get dotnet version. Make sure dotnet is installed and in vscode PATH');
    }

    const dotnetVersionParts = dotnetVersion.split('.');
    const majorVersion = parseInt(dotnetVersionParts[0]);

    if (isNaN(majorVersion)) {
        throw new Error(`Failed to parse dotnet version: ${dotnetVersion}`);
    }

    if (majorVersion < 8) {
        throw new Error(`csharp-ls requires dotnet version 8.0 or higher. Current version is ${dotnetVersion}`);
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
