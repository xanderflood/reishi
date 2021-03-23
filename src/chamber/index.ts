import axios from 'axios';
import { AxiosInstance, AxiosResponse } from 'axios';

import * as state from '../state';

const htgModule = "sensor";
const fanModule = "fan";
const humModule = "humidifier";

const MINUTE = 60000;

export class MisconfiguredError extends Error {}

export interface ServerConfig {
	address: string;

	fanPin: string;
	humPin: string;
	temperatureAdcChannel: number;
	humidityAdcChannel: number;
	calibrationAdcChannel: number;
	rhAdustment: number;
};
export interface ChamberConfig {
	server: ServerConfig;

	rhLowPercent: number;
	rhHighPercent: number;
};

export class Server {
	private http: AxiosInstance;
	constructor(private config: ServerConfig) {
		// Configure axios to only throw on transport-level errors.
		// This makes 404-handling a little easier
		this.http = axios.create({
			validateStatus: () => true,
		});
	}

	async configure() {
		const resp = await this.http.post(`http://${this.config.address}:3141/initialize`, this.backendConfig());

		this.handleResponseErrors(resp);
	}

	async setFan(on: boolean) {
		let resp = await this.http.post(`http://${this.config.address}:3141/act`, {
			module: fanModule,
			action: "set",
			config: {high: on}
		});

		this.handleResponseErrors(resp);
	}

	async setHum(on: boolean) {
		let resp = await this.http.post(`http://${this.config.address}:3141/act`, {
			module: humModule,
			action: "set",
			config: {high: on}
		});

		this.handleResponseErrors(resp);
	}

	async readTempF(): Promise<number> {
		let resp = await this.http.post(`http://${this.config.address}:3141/act`, {
			module: htgModule,
			action: "tf",
		});
		
		this.handleResponseErrors(resp);
		return resp.data.result as number;
	}

	async readRH(): Promise<number> {
		let resp = await this.http.post(`http://${this.config.address}:3141/act`, {
			module: htgModule,
			action: "rh",
		});
		
		this.handleResponseErrors(resp);
		return resp.data.result as number;
	}

	private handleResponseErrors(response: AxiosResponse) {
		switch (response.status) {
		case 200:
			break;
		default:
		 	throw new MisconfiguredError();
		}
	}

	private backendConfig(): any {
		return {
			modules: {
				[htgModule]: {
					source: "htg3535ch",
					config: {
						temperature_adc_channel: this.config.temperatureAdcChannel,
						humidity_adc_channel: this.config.humidityAdcChannel,
						calibration_adc_channel: this.config.calibrationAdcChannel,
						rh_adjustment: this.config.rhAdustment
					}
				},
				[fanModule]: {
					source: "relay",
					config: { pin: this.config.fanPin }
				},
				[humModule]: {
					source: "relay",
					config: { pin: this.config.humPin }
				},
			}
		};
	}
}

export class Chamber {
	private server: Server;
	private retryer: Retryer;

	constructor(private config: ChamberConfig) {
		this.server = new Server(config.server);
		this.retryer = new Retryer((error) => {
			// Retry anything except a 404
			return !(error instanceof MisconfiguredError);
		});
	}

	state(): state.StateMachine {
		const self = this;
		return {
			configuring: async (): Promise<string> => {
				await self.retryer.retry(async () => { return self.server.configure(); });

				return 'clearing';
			},
			clearing: async (): Promise<string> => {
				await self.retryer.retry(async () => { return self.server.setFan(false); });
				await self.retryer.retry(async () => { return self.server.setHum(false); });

				while (true) {
					let tf = await self.retryer.retry(async () => { return self.server.readTempF() });
					let rh = await self.retryer.retry(async () => { return self.server.readRH() });

					console.log("temp (F):", tf);
					console.log("humidity (%RH):", rh);

					if (rh < this.config.rhLowPercent) {
						return 'humidifying';
					}
					
					await sleep(MINUTE);
				}
			},
			humidifying: async (): Promise<string> => {
				await self.retryer.retry(async () => { return self.server.setFan(true); });
				await self.retryer.retry(async () => { return self.server.setHum(true); });

				while (true) {
					let tf = await self.retryer.retry(async () => { return self.server.readTempF() });
					let rh = await self.retryer.retry(async () => { return self.server.readRH() });

					console.log("temp (F):", tf);
					console.log("humidity (%RH):", rh);

					if (rh > this.config.rhHighPercent) {
						return 'circulating';
					}
					
					await sleep(MINUTE);
				}
			},
			circulating: async (): Promise<string> => {
				await self.retryer.retry(async () => { return self.server.setFan(true); });
				await self.retryer.retry(async () => { return self.server.setHum(false); });

				await sleep(3 * MINUTE);

				return 'clearing';
			},
		};
	}
}

interface RetryChecker {
	(error: any): boolean;
}

class Retryer {
	constructor(private isRetryable: RetryChecker) {}

	async retry(action: () => Promise<any>): Promise<any> {
		while (true) {
			try {
				return action();
			} catch (error) {
				if (!this.isRetryable(error)) throw error;

				console.log("retrying in 10s because:", error.message);
				await sleep(10000);
			}
		}
	}
}

function sleep(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}
