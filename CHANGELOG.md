# [0.1.6]
- Documentation: changelog and README updates. Pins csharp-ls-vs 1.2.5. No functional changes since 0.1.5.

# [0.1.5]
- Pins [csharp-ls-vs 1.2.4](https://www.nuget.org/packages/csharp-ls-vs): Visual Studio 2026 / MSBuild v18 support. The language server self-aligns its net472 MSBuild build host to the installed Visual Studio at startup (via vswhere), fixing loading of old-style .NET Framework solutions on machines with VS 2026 installed. No-op on VS 2022.

# [0.0.26]
- [csharp-ls@0.18.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.18.0)

# [0.0.25]
- [csharp-ls@0.17.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.17.0)

# [0.0.24]
- [csharp-ls@0.16.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.16.0)

# [0.0.23]
- [csharp-ls@0.15.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.15.0)

# [0.0.22]
- [csharp-ls@0.14.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.14.0)

# [0.0.21]
- [csharp-ls@0.13.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.13.0)

# [0.0.20]
- Make sure `csharp-ls.csharp-ls-executable` setting is actually taken into account (@razzmatazz).
- [csharp-ls@0.11.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.11.0). From now on NET 8 SDK is required. (@razzmatazz)
- improve error messages when dotnet is not found or version is not supported

# [0.0.19]
- [csharp-ls@0.10.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.10.0)

# [0.0.18]
- [csharp-ls@0.9.0](https://github.com/razzmatazz/csharp-language-server/releases/tag/0.9.0)
- "Go to definition" to decompiled metadata
- activate extension only when sln file exists in workspace or when command is triggered manually
- ability to select target solution
- save previous solution selection and autostart language server if we have it saved
- autostart language server if workspace contains single sln file
- ability to use custom build and not released csharp-ls version
