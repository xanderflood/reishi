import * as state from './state';
import * as chamber from './chamber';

const config: chamber.ChamberConfig = {
	server: {
		address: process.env["SERVER_IP"],
		fanPin: "20",
		humPin: "26",
		temperatureAdcChannel: 4,
		humidityAdcChannel: 5,
		calibrationAdcChannel: 7,
		rhAdustment: 6.93131703213524
	},

	rhLowPercent: 80,
	rhHighPercent: 90,
};
const ch = new chamber.Chamber(config);
state.start(ch.state(), 'configuring', 'configuring');
