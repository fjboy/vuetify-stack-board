import API from "./api.js";
import { volumeTable } from "./tables.js";

export class Message {
    constructor() {
        this.info = function (msg, timeout = 3) {
            VuetifyMessageSnackbar.Notify.topRight().timeout(timeout * 1000).info(msg);
        };
        this.success = function (msg, timeout = 2) {
            VuetifyMessageSnackbar.Notify.topRight().timeout(timeout * 1000).success(msg);
        };
        this.error = function (msg, timeout = 5) {
            VuetifyMessageSnackbar.Notify.topRight().timeout(timeout * 1000).error(msg)
        };
    }
}

export class Alert {
    constructor() {
        this.info = function (msg, timeout = 5) {
            VuetifyMessageSnackbar.Notify.top().timeout(timeout * 1000).info(msg);
        };
        this.success = function (msg, timeout = 5) {
            VuetifyMessageSnackbar.Notify.top().timeout(timeout * 1000).success(msg);
        };
        this.error = function (msg, timeout = 5) {
            VuetifyMessageSnackbar.Notify.top().timeout(timeout * 1000).error(msg)
        };
        this.warn = function (msg, timeout = 5) {
            VuetifyMessageSnackbar.Notify.top().timeout(timeout * 1000).warning(msg)
        };
    }
}

export class Utils {
    static nowFormat(dateObject=null) {
        let date = dateObject ? dateObject : new Date();
        let month = date.getMonth() + 1;
        let day = date.getDate()
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let seconds = date.getSeconds();
        return `${date.getFullYear()}${month >= 10 ? month : '0' + month}${day >= 10 ? day : '0' + day}-` +
            `${hours >= 10 ? hours : '0' + hours}:${minutes >= 0 ? minutes : '0' + minutes}:${seconds >= 0 ? seconds : '0' + seconds}`;
    }
    static parseUTCToLocal(utcString){
        if (! utcString.endsWith('Z')){
            utcString += 'Z'
        }
        return Utils.nowFormat(new Date(`${utcString}`))
    }
    static checkServerStatus(server_id) {
        API.server.detail({ id: server_id }).then(resp => {
            let status = resp.data.server.status;
            if (status == 'active') {
                MESSAGE.success(`?????? ${server_id} ????????????`);
                return;
            } else if (status == 'error') {
                MESSAGE.error(`??? ${volume_id} ????????????`);
                volumeTable.refresh();
                return;
            };
        });
    }
    static getRandomName(prefix = null) {
        let date = this.nowFormat()
        return prefix ? `${prefix}-${date}` : date;
    }
    static checkVolumeStatus(volume_id) {
        API.volume.show(volume_id).then(resp => {
            let status = resp.data.volume.status;
            if (status == 'available') {
                MESSAGE.success(`??? ${volume_id} ????????????`);
                volumeTable.refresh()
                return;
            } else if (status == 'error') {
                MESSAGE.error(`??? ${volume_id} ????????????`);
                volumeTable.refresh();
                return;
            };
            setTimeout(function () {
                Utils.checkVolumeStatus(volume_id)
            }, 5 * 1000)
        });
    }
    static checkVolumeAttached(volume_id) {
        API.volume.show(volume_id).then(resp => {
            let status = resp.data.volume.status;
            if (status == 'in-use') {
                MESSAGE.success(`??? ${volume_id} ????????????`);
                return;
            } else if (status == 'error') {
                MESSAGE.error(`??? ${volume_id} ????????????`);
                return;
            };
            setTimeout(function () {
                Utils.checkVolumeAttached(volume_id)
            }, 3 * 1000)
        });
    }
    static checkVolumeDetached(volume_id) {
        API.volume.show(volume_id).then(resp => {
            let status = resp.data.volume.status;
            if (status == 'available') {
                MESSAGE.success(`??? ${volume_id} ????????????`);
                return;
            } else if (status == 'error') {
                MESSAGE.error(`??? ${volume_id} ????????????`);
                return;
            };
            setTimeout(function () {
                Utils.checkVolumeDetached(volume_id)
            }, 5 * 1000)
        });
    }
    static humanRam(size) {
        if (size < 1024) {
            return `${size}MB`
        }
        return `${(size / 1024).toFixed(0)}GB`
    }
    static sleep(seconds) {
        seconds = (seconds || 0);
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(true);
            }, seconds * 1000)
        })
    }

}

//             error  warning info debug
// logLevels = [0,    1,      2,   3]
export var Level = {
    ERROR: 0,
    WARNING: 1,
    INFO: 2,
    DEBUG: 3,
}

export class Logger {
    constructor(kwargs = {}) {
        this.level = kwargs['level'] || Level.INFO;
    }
    debug(msg) {
        if (this.level < Level.DEBUG){
            return
        }
        console.debug(`${new Date().toISOString()} DEBUG ${msg}`)
    };
    info(msg) {
        if (this.level < Level.INFO){
            return
        }
        console.info(`${new Date().toISOString()} INFO ${msg}`)
    };
    warn(msg) {
        if (this.level < Level.WARNING){
            return
        }
        console.warn(`${new Date().toISOString()} WARN ${msg}`)
    };
    error(msg) {
        console.error(`${new Date().toISOString()} ERROR ${msg}`)
        VuetifyMessageSnackbar.Notify.top().timeout(timeout * 1000).error(msg)
    };
}

export const MESSAGE = new Message();
export const ALERT = new Alert();
export const LOG = new Logger({level: Level.DEBUG});
