const dgram = require('dgram');

class MarstekCtApi {
    constructor(host, deviceType, batteryMac, ctMac, ctType) {
        this.host = host;
        this.port = 12345;
        this.deviceType = deviceType;
        this.batteryMac = batteryMac;
        this.ctMac = ctMac;
        this.ctType = ctType;
        this.timeout = 5000; // in ms
        this.payload = this.buildPayload();
    }

    buildPayload() {
        const SOH = 0x01;
        const STX = 0x02;
        const ETX = 0x03;
        const SEPARATOR = '|';

        const messageFields = [
            this.deviceType,
            this.batteryMac,
            this.ctType,
            this.ctMac,
            '0',
            '0'
        ];

        const message = SEPARATOR + messageFields.join(SEPARATOR);
        const messageBytes = Buffer.from(message, 'ascii');

        let baseSize = 1 + 1 + messageBytes.length + 1 + 2;
        let totalLength = baseSize + String(baseSize + 2).length;

        if (String(totalLength).length !== String(baseSize + 2).length) {
            totalLength = baseSize + String(totalLength).length;
        }

        const payload = Buffer.alloc(2 + String(totalLength).length + messageBytes.length + 1);
        let offset = 0;
        payload.writeUInt8(SOH, offset++);
        payload.writeUInt8(STX, offset++);
        offset += payload.write(String(totalLength), offset, 'ascii');
        offset += messageBytes.copy(payload, offset);
        payload.writeUInt8(ETX, offset++);

        let xor = 0;
        for (let i = 0; i < offset; i++) {
            xor ^= payload[i];
        }

        const checksum = Buffer.from(xor.toString(16).padStart(2, '0'), 'ascii');
        return Buffer.concat([payload.slice(0, offset), checksum]);
    }

    decodeResponse(data) {
        try {
            const message = data.slice(4, -3).toString('ascii');
            const fields = message.split('|').slice(1);

            const labels = [
                "meter_dev_type", "meter_mac_code", "hhm_dev_type", "hhm_mac_code",
                "A_phase_power", "B_phase_power", "C_phase_power", "total_power",
                "A_chrg_nb", "B_chrg_nb", "C_chrg_nb", "ABC_chrg_nb", "wifi_rssi",
                "info_idx", "x_chrg_power", "A_chrg_power", "B_chrg_power", "C_chrg_power",
                "ABC_chrg_power", "x_dchrg_power", "A_dchrg_power", "B_dchrg_power",
                "C_dchrg_power", "ABC_dchrg_power"
            ];

            const parsed = {};
            labels.forEach((label, i) => {
                const val = fields[i];
                parsed[label] = isNaN(val) ? val : parseInt(val, 10);
            });

            return parsed;
        } catch (err) {
            return { error: "Invalid ASCII encoding or unexpected format" };
        }
    }

    fetchData(callback) {
        const socket = dgram.createSocket('udp4');

        const timeoutHandle = setTimeout(() => {
            socket.close();
            callback({ error: "Timeout - No response from meter" });
        }, this.timeout);

        socket.once('message', (msg) => {
            clearTimeout(timeoutHandle);
            socket.close();
            callback(this.decodeResponse(msg));
        });

        socket.send(this.payload, 0, this.payload.length, this.port, this.host, (err) => {
            if (err) {
                clearTimeout(timeoutHandle);
                socket.close();
                callback({ error: "Send error: " + err.message });
            }
        });
    }

    testConnection(callback) {
        this.fetchData(callback);
    }
}

module.exports = MarstekCtApi;
