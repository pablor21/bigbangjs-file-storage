import { Bucket } from '@bigbangjs/file-storage';
import fs from 'fs-extra';
import { generateBuckets, rootPath } from '../functions';
import https from 'https';



export const suite002 = (autoRemove = true) => describe('Siute 003', () => {

    if (autoRemove) {
        beforeAll(async () => {
            fs.removeSync(rootPath)
        });
        afterAll(async () => {
            fs.removeSync(rootPath)
        });
    }

    test('Manipulate files', async () => {
        const storage = (await generateBuckets('test02'));
        const bucket01 = storage.getBucket('bucket01');
        expect(bucket01).toBeInstanceOf(Bucket);
        const bucket02 = storage.getBucket('bucket02');
        expect(bucket02).toBeInstanceOf(Bucket);

        //save a simple text file
        const file = (await bucket01.putFile('/pepe/test 01.txt', 'Hello World! This file has been created from text')).result;
        expect((await bucket01.fileExists(file)).result).toBe(true);
        expect((await bucket01.getFileContents(file)).result.toString()).toBe('Hello World! This file has been created from text');
        const fileFromBuffer = (await bucket01.putFile('test 02.txt', Buffer.from('Hello World! This file has been created from buffer'), { returning: true })).result;
        expect((await bucket01.fileExists(fileFromBuffer)).result).toBe(true);
        const request = await makeRequest('https://kitsu.io/api/edge/anime');
        const fileFromStream = (await bucket01.putFile('test 03.json', request)).result;
        expect((await bucket01.fileExists(fileFromStream)).result).toBe(true);

        //list files
        const files = (await bucket01.listFiles('', { recursive: true })).result.entries;
        expect(files).toHaveLength(3);

        for (const f in files) {
            expect((await bucket01.fileExists(files[f])).result).toBe(true);
        }


        // create multiple files
        for (let i = 1; i < 11; i++) {
            for (let j = 1; j < 11; j++) {
                const file = (await bucket02.putFile(`multiple/${i}/file ${i} ${j}.txt`, `Hello wold ${i} ${j}`, { overwrite: true })).result;
                expect((await bucket02.fileExists(file)).result).toBe(true);
            }
        }
        //list files
        const multipleFiles = (await bucket02.listFiles('multiple', { recursive: true })).result.entries;
        expect(multipleFiles).toHaveLength(100);

        await bucket02.copyFiles('multiple', 'multiple_copy', '**/*1.txt');
        expect((await bucket02.listFiles('multiple_copy', { recursive: true })).result.entries).toHaveLength(10);

        await bucket02.moveFiles('multiple', 'multiple_move', '**/*1.txt');
        expect((await bucket02.listFiles('multiple_move', { recursive: true })).result.entries).toHaveLength(10);
        expect((await bucket02.listFiles('multiple', { recursive: true })).result.entries).toHaveLength(90);

        await bucket02.deleteFiles('multiple_move', '**/*1.txt', { cleanup: false });
        await bucket02.removeEmptyDirectories();


        await bucket01.deleteFile(file);
    })


});

function makeRequest(url: string): Promise<any> {
    const p = new Promise((resolve) => {
        https.get(url, response => resolve(response));
    });
    return p;
}