import { FileStorage } from "@bigbangjs/file-storage";
import { FilesystemProvider, FileSystemProviderConfig } from "../src";
import path from 'path';
import fs from 'fs-extra';

FileStorage.registerProviderType('fs', FilesystemProvider);


export const rootPath = path.resolve('./private/test-storage/');




export async function generateStorage(testName: string) {
    const context: any = {};
    context.storage = new FileStorage({
        logger: console
    });
    const storage = context.storage;
    // provider config
    const objProviderConfig01: FileSystemProviderConfig = {
        root: path.join(rootPath, testName),
        type: 'fs'
    };
    const urlProviderConfig01 = "fs://./private/test-storage/test02?name=provider02&mode=0777";

    await storage.addProvider('provider01', objProviderConfig01);
    await storage.addProvider('provider02', {
        uri: urlProviderConfig01
    });
    return context;
}

export async function generateBuckets(testName: string) {
    const storage = (await generateStorage(testName)).storage as FileStorage;
    (await storage.getProvider('provider01').addBucket('bucket01', { root: '/bucket01' }));
    (await storage.getProvider('provider01').addBucket('bucket02', { root: '/bucket02' }));
    return storage;
}