const stream = require('stream');
const cp = require('child_process');
const EventEmitter = require('events');

module.exports = class NodeFFmpegAPI extends EventEmitter {
    constructor() {
        super();
        this.inputStream = {
            readable: [],
            fileDescriptor: []
        };
        this.outputStream = {
            writable: [],
            fileDescriptor: []
        };
        this.args = [
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-progress',
            'pipe:3'
        ];
        this.stdio = ['pipe', 'pipe', 'pipe', 'pipe'];
    }

    makeInput(input) {
        if (input instanceof stream.Readable) {
            this.args.push(
                '-i',
                'pipe:'.concat(this.stdio.length)
            );
            this.inputStream.readable.push(input);
            this.inputStream.fileDescriptor.push(
                this.stdio.length
            );
            this.stdio.push('pipe');
        } else {
            this.args.push('-i', input);
        }
        return this;
    }

    makeOutput(output) {
        if (output instanceof stream.Writable) {
            this.args.push(
                'pipe:'.concat(this.stdio.length)
            );
            this.outputStream.writable.push(output);
            this.outputStream.fileDescriptor.push(
                this.stdio.length
            );
            this.stdio.push('pipe');
        } else {
            this.args.push(output);
        }
        return this;
    }

    makeInputOptions(options = []) {
        this.args.push(options);
        return this;
    }

    makeOutputOptions(options = []) {
        this.args.push(options);
        return this;
    }

    makeFFmpegOptions(options = []) {
        this.args.unshift(options);
        return this;
    }

    run() {
        const ffmpegProcess = cp.spawn(
            'ffmpeg',
            this.args.flat(),
            {
                stdio: this.stdio
            }
        );
        if (this.inputStream.readable.length) {
            this.inputStream.readable.forEach(
                (stream, index) => {
                    stream
                        .on('error', (error) =>
                            this.emit('error', error)
                        )
                        .pipe(
                            ffmpegProcess.stdio[
                                this.inputStream
                                    .fileDescriptor[index]
                            ]
                        )
                        .on('error', (error) =>
                            this.emit('error', error)
                        );
                }
            );
        }
        if (this.outputStream.writable.length) {
            this.outputStream.writable.forEach(
                (stream, index) => {
                    ffmpegProcess.stdio[
                        this.outputStream.fileDescriptor[
                            index
                        ]
                    ]
                        .on('error', (error) =>
                            this.emit('error', error)
                        )
                        .pipe(stream)
                        .on('error', (error) =>
                            this.emit('error', error)
                        );
                }
            );
        }
        ffmpegProcess.on('error', (error) =>
            this.emit('error', error)
        );
        ffmpegProcess.on('close', (code, signal) =>
            this.emit('close', code, signal)
        );
        ffmpegProcess.stdio[3].on('data', (data) =>
            this.emit('progress', data.toString())
        );
        ffmpegProcess.stderr.on('data', (data) =>
            this.emit('error', data.toString())
        );
    }
};
