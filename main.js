"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const MarstekCtApi = require('./lib/marstek_ct');

// Load your modules here, e.g.:
// const fs = require("fs");

class MarstekCt extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "marstek_ct",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		const meter = new MarstekCtApi(
			this.config.host,
			this.config.deviceType,
			this.config.batteryMac,
			this.config.ctMac,
			this.config.ctType
		);

		const pollRateMs = (parseInt(this.config.pollRate, 10) || 60) * 1000; // Default: 60 Sekunden

		const fetchAndUpdate = async () => {
			meter.fetchData(async (data) => {
				if (data.error) {
					this.log.warn(data.error);
				} else {
					for (const [key, value] of Object.entries(data)) {
						const id = `data.${key}`;
						await this.setObjectNotExistsAsync(id, {
							type: "state",
							common: {
								name: key,
								type: typeof value === "number" ? "number" : "string",
								role: "value",
								read: true,
								write: false,
							},
							native: {},
						});
						await this.setStateAsync(id, { val: value, ack: true });
					}
				}
			});
		};

		// Initialer Abruf
		await fetchAndUpdate();

		// Wiederholter Abruf im Intervall
		this.pollingInterval = setInterval(fetchAndUpdate, pollRateMs);
	}


	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}


	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}



}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new MarstekCt(options);
} else {
	// otherwise start the instance directly
	new MarstekCt();
}
