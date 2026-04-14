import { CONFIG_JSON_SCHEMA, CONFIG_UI_HINTS, parseConfig, } from "./config.js";
import { registerMemorUploadCli, registerMemorUploadCommands, } from "./commands.js";
import { MemorUploadController } from "./service.js";
const memorUploadPlugin = {
    id: "memor-upload",
    name: "MEMOR Upload",
    description: "Bridge CHEK buddy-room @ mentions into a stable local OpenClaw session and auto-reply from there.",
    configSchema: {
        parse: parseConfig,
        jsonSchema: CONFIG_JSON_SCHEMA,
        uiHints: CONFIG_UI_HINTS,
    },
    register(api) {
        const config = parseConfig(api.pluginConfig);
        const controller = new MemorUploadController({
            config,
            logger: api.logger,
            runtimeConfig: api.runtime.config,
        });
        registerMemorUploadCommands(api, controller);
        api.registerCli(({ program }) => {
            registerMemorUploadCli(program, api, controller);
        }, { commands: ["chek"] });
        api.registerService({
            id: "memor-upload",
            start: async ({ stateDir }) => {
                controller.attachStateDir(stateDir);
                await controller.start();
            },
            stop: async () => {
                await controller.stop();
            },
        });
    },
};
export default memorUploadPlugin;
