
// describe('to delete', async () => {

import { suite001 } from "./suites/0001_storage"
import { suite002 } from "./suites/0002_files";

//     const allDirs = await fs.readdir('./', { withFileTypes: true });
//     console.log(allDirs);
// })


describe('Runing tests', () => {
    const autoDelete = true;
    suite001(autoDelete);
    suite002(autoDelete);
})