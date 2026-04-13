import type { JsonObject, MentionTask } from "./types.js";
export declare class ChekApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body: unknown);
}
export declare class ChekApiClient {
    private readonly baseUrl;
    private readonly accessToken;
    constructor(params: {
        baseUrl: string;
        accessToken: string;
    });
    private requestJson;
    probe(): Promise<void>;
    listPendingMentionTasks(pageSize?: number): Promise<MentionTask[]>;
    claimMentionTask(taskId: string): Promise<MentionTask>;
    completeMentionTask(taskId: string, result: JsonObject): Promise<MentionTask>;
    failMentionTask(taskId: string, result: JsonObject): Promise<MentionTask>;
    sendRoomMessage(postId: string, content: string): Promise<JsonObject>;
}
