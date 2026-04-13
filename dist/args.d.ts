export type SetupArgs = {
    token?: string;
    backend?: string;
    session?: string;
    interval?: number;
    enable?: boolean;
};
export declare function parseSetupArgs(raw: string): SetupArgs;
