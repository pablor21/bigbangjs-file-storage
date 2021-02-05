import { storage001 } from "./suites/0001_storage";
import { directories002 } from "./suites/0002_directories";
import { files003 } from "./suites/0003_files";

// describe('to delete', async () => {

//     const allDirs = await fs.readdir('./', { withFileTypes: true });
//     console.log(allDirs);
// })


describe('Runing tests', () => {

    const autoRemove = true;
    storage001(autoRemove);
    directories002(autoRemove);
    files003(autoRemove);
})