import * as stream from 'stream';
import * as Proto from 'typescript/lib/protocol';

interface TsServerProcess {
	readonly stdout: stream.Readable;
	write(serverRequest: Proto.Request): void;

	on(name: 'exit', handler: (code: number | null) => void): void;
	on(name: 'error', handler: (error: Error) => void): void;

	kill(): void;
}

interface OngoingRequestCanceller {
	tryCancelOngoingRequest(seq: number): boolean;
}

export default class ClusterTsServerProcess implements TsServerProcess {
	readonly requestCanceller: OngoingRequestCanceller;
	readonly stdout: stream.Readable;

	constructor(options: any) {};

	write(serverRequest: Proto.Request): void;

	on(name: 'exit', handler: (code: number | null) => void): void;
	on(name: 'error', handler: (error: Error) => void): void;

	kill(): void;
};
