export interface IMatcher {
    readonly available: boolean;
    match(path: string | string[], pattern: string): boolean | string[];
}

export class DefaultMatcher implements IMatcher {

    public readonly available: boolean;
    private readonly minimatch: any;
    constructor() {
        try {
            this.minimatch = require('minimatch');
            this.available = true;
        } catch (ex) {
            this.available = false;
        }
    }

    public match(path: string | string[], pattern: string): boolean | string[] {
        if (Array.isArray(path)) {
            return this.minimatch.match(path, pattern, { matchBase: true });
        }
        return this.minimatch(path, pattern, { matchBase: true });
    }

}
