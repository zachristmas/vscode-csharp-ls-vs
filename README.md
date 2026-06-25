# C# Language Server - Visual Studio Enhanced Fork

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Visual Studio](https://img.shields.io/badge/Visual%20Studio-Supported-blue.svg)](https://visualstudio.microsoft.com/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.80+-007ACC.svg)](https://code.visualstudio.com/)

**Enhanced by Zach Christmas** | **Original VS Code extension by Vytautas Survila**

VS Code extension for the enhanced [csharp-language-server](https://github.com/zachristmas/csharp-language-server) with Visual Studio MSBuild support and lazy solution loading.

## 🚀 What's New in This Fork

### Visual Studio MSBuild Support
- ✅ **Automatic detection** of Visual Studio Community/Professional installations
- ✅ **Custom MSBuild path configuration** in VS Code settings
- ✅ **Environment variable integration** for seamless setup
- ✅ **Enhanced error handling** for MSBuild issues

### Lazy Solution Loading
- ⚡ **On-demand loading** - solutions load only when you open C# files
- 🚀 **Faster startup** - no more waiting for all solutions to load at once
- 🎯 **Multi-solution support** - perfect for large monorepos
- 🔄 **Smart solution selection** with command palette integration

## 📦 Installation

### Prerequisites
1. **Install the language server** first:
   ```bash
   dotnet tool install --global csharp-ls-vs
   ```

2. **Install this extension** from the VS Code marketplace

### Requirements
- **.NET 9.0 SDK** or later
- **Visual Studio** Community/Professional (recommended)
- **VS Code 1.80** or later

## ⚙️ Configuration

### Basic Setup (Recommended)
```json
{
  "csharp-ls.csharp-ls-executable": "csharp-ls-vs",
  "csharp-ls.msbuild.path": "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin"
}
```

### Advanced Configuration
| Setting | Description | Default |
|---------|-------------|---------|
| `csharp-ls.csharp-ls-executable` | Path to language server executable | `"csharp-ls-vs"` |
| `csharp-ls.msbuild.path` | MSBuild directory path | `""` |
| `csharp-ls.msbuild.executable` | MSBuild executable path | `""` |
| `csharp-ls.trace.server` | LSP communication tracing | `{"verbosity": "off"}` |

## 🎯 Usage

### Automatic Solution Loading
1. **Open VS Code** in your C# workspace
2. **Open any .cs file** → Solution loads automatically via lazy loading
3. **IntelliSense activates** with full project context

### Manual Solution Selection
- **Command Palette** (`Ctrl+Shift+P`)
- Type: `csharp-ls: Select solution or project`
- Choose from available solutions

### Multiple Solutions
- Each solution loads **only when needed**
- Switch between projects seamlessly
- No performance impact from unused solutions

## ✨ Features

- 🔍 **Go to Definition** (including decompiled metadata)
- 💡 **IntelliSense** & code completion
- 🏷️ **Symbol search** across projects
- 🔧 **Code actions** & refactoring
- 📝 **Hover documentation**
- ⚠️ **Diagnostics** & error reporting
- 🎨 **Syntax highlighting** via Roslyn
- 📁 **Multi-solution workspaces**

## 🛠️ Troubleshooting

### Language Server Not Starting
1. Verify installation: `dotnet tool list --global`
2. Check version: `csharp-ls-vs --version`
3. Review VS Code Output → "C# Language Server"

### MSBuild Issues
1. Ensure Visual Studio is installed
2. Verify MSBuild path exists
3. Configure custom path in settings if needed
4. Check Output panel for specific errors

### Solution Loading Problems
1. Ensure .sln files exist in workspace
2. Use "Select solution" command manually
3. Check file permissions and paths

## 📄 Attribution & License

### 🙏 Original Work
This extension is a fork of outstanding work by:
- **[Vytautas Survila](https://github.com/vytautassurvila)** - Original [vscode-csharp-ls](https://github.com/vytautassurvila/vscode-csharp-ls)
- **[Saulius Menkevičius](https://github.com/razzmatazz)** - Original [csharp-language-server](https://github.com/razzmatazz/csharp-language-server)

### 🔧 Fork Enhancements
- **[Zach Christmas](https://github.com/zachristmas)** - Visual Studio MSBuild support and lazy loading integration

### 📋 License
MIT License (same as original projects)

### ⚠️ Support Notice
**This is a fork with limited support.** 

- **For general language server issues**: Check the [original csharp-language-server](https://github.com/razzmatazz/csharp-language-server)
- **For general extension issues**: Check the [original VS Code extension](https://github.com/vytautassurvila/vscode-csharp-ls)
- **For fork-specific issues**: Use this [fork's issue tracker](https://github.com/zachristmas/vscode-csharp-ls-vs/issues)

## 🔗 Related Projects

- **Language Server Fork**: [zachristmas/csharp-language-server](https://github.com/zachristmas/csharp-language-server)
- **Original Language Server**: [razzmatazz/csharp-language-server](https://github.com/razzmatazz/csharp-language-server)
- **Original VS Code Extension**: [vytautassurvila/vscode-csharp-ls](https://github.com/vytautassurvila/vscode-csharp-ls)

---

**Thank you to the original authors for their excellent foundation!** 🎉

**Enjoy enhanced C# development with Visual Studio MSBuild support!** 🚀

## 📝 Changelog

**0.1.5** — Visual Studio 2026 / MSBuild v18 support (via csharp-ls-vs 1.2.4): the language server self-aligns its MSBuild build host to the installed Visual Studio at startup, fixing old-style .NET Framework solution loading on machines with VS 2026. No-op on VS 2022.

See the full [CHANGELOG](https://github.com/zachristmas/vscode-csharp-ls-vs/blob/master/CHANGELOG.md).
