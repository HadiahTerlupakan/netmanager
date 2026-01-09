declare module 'adbkit-apkreader' {
    interface ApkManifest {
        versionCode: number;
        versionName: string;
        package: string;
    }

    interface ApkReader {
        readManifest(): Promise<ApkManifest>;
    }

    function open(filePath: string): Promise<ApkReader>;
    export = { open };
}
