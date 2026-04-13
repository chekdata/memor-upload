import type { Command } from "commander";
import type { OpenClawPluginApi } from "./openclaw-types.js";
import { MemorUploadController } from "./service.js";
export declare function registerMemorUploadCommands(api: OpenClawPluginApi, controller: MemorUploadController): void;
export declare function registerMemorUploadCli(program: Command, api: OpenClawPluginApi, controller: MemorUploadController): void;
