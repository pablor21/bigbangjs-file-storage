import { suite001 } from "./suites/0001_storage";
import { suite002 } from "./suites/0002_files";

// describe('to delete', async () => {

//     const allDirs = await fs.readdir('./', { withFileTypes: true });
//     console.log(allDirs);
// })


describe('Runing tests', () => {
    const autoRemove = false;
    suite001(autoRemove);
    suite002(autoRemove);
})