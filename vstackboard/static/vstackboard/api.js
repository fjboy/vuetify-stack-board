import { LOG, Utils, ALERT } from "./lib.js";

class Restfulclient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    _parseToQueryString(filters) {
        if (!filters) { return '' }
        let queryParams = [];
        for (var key in filters) {
            if ( Array.isArray(filters[key])){
                LOG.debug(`filters: ${filters[key]}`)
                filters[key].forEach(value => {
                    queryParams.push(`${key}=${value}`)
                })
            } else {
                queryParams.push(`${key}=${filters[key]}`)
            }
        }
        return queryParams.join('&');
    }
    async get(id) { let resp = await axios.get(`${this.baseUrl}/${id}`); return resp.data };
    async delete(id) { let resp = await axios.delete(`${this.baseUrl}/${id}`) ; return resp.data };
    async post(body) { let resp = await axios.post(`${this.baseUrl}`, body) ; return resp.data };
    async put(id, body) { let resp = await axios.put(`${this.baseUrl}/${id}`, body); return resp.data };
    async show(id) {  return await this.get(id)};
    async list(filters = {}) {
        let queryString = this._parseToQueryString(filters);
        let url = this.baseUrl;
        if (queryString) { url += `?${queryString}` }
        let resp = await axios.get(`${url}`);
        return resp.data;
    };
}
class ClientExt extends Restfulclient {
    constructor(baseUrl) { super(baseUrl); }

    async detail(filters = {}) {
        let queryString = this._parseToQueryString(filters);
        let url = `${this.baseUrl}/detail`;
        if (queryString) {
            url += `?${queryString}`
        }
        let resp = await axios.get(url);
        return resp.data;
    };
}

class Hypervisor extends ClientExt {
    constructor() { super('/computing/os-hypervisors') }
    async statistics() { let resp = await axios.get(`${this.baseUrl}/statistics`); return resp.data; };
}

class Flavor extends ClientExt {
    constructor() { super('/computing/flavors') }
    async create(data) { return await this.post({ flavor: data }); }
    async getExtraSpecs(id) {
        return await this.get(`${id}/os-extra_specs`);
    }
    async updateExtras(id, extras) {
        let resp = await axios.post(`${this.baseUrl}/${id}/os-extra_specs`, { 'extra_specs': extras })
        return resp.data;
    }
    async deleteExtra(id, key) {
        return (await axios.delete(`${this.baseUrl}/${id}/os-extra_specs/${key}`)).data;
    }

    parseExtras(content) {
        let extras = {};
        let extraLines = content.split('\n');
        for (var i = 0; i < extraLines.length; i++) {
            let line = extraLines[i];
            if (line.trim() == '') { continue; }
            let kv = line.split('=');
            if (kv.length != 2) {
                ALERT.error(`??????????????????: ${line}`)
                return;
            }
            let key = kv[0].trim();
            let value = kv[1].trim();
            if (key == '' || value == '') {
                ALERT.error(`??????????????????: ${line}`)
                return;
            }
            extras[key] = value;
        }
        return extras;
    }
}

class AZ extends ClientExt {
    constructor() { super('/computing/os-availability-zone') }
}
class Keypair extends Restfulclient {
    constructor() { super('/computing/os-keypairs') }
}
class ComputeService extends Restfulclient {
    constructor() { super('/computing/os-services') }

    async forceDown(id, down = true) {
        let resp = await axios.put(`${this.baseUrl}/${id}`, { forced_down: down });
        return resp.data;
    }
    async disable(id) {
        let resp = await axios.put(`${this.baseUrl}/${id}`, { status: 'disabled' });
        return resp.data;
    }
    async enable(id) {
        let resp = await axios.put(`${this.baseUrl}/${id}`, { status: 'enabled' });
        return resp.data;
    }
}

class Usage extends Restfulclient {
    constructor() { super('/computing/os-simple-tenant-usage') }
}

class Server extends ClientExt {
    constructor() { super('/computing/servers') };
    async  detail(filters = {}) {
        filters.all_tenants = 1
        return await super.detail(filters)
    }
    async list(filters = {}) {
        filters.all_tenants = 1
        return await super.list(filters)
    }
    _parseToQueryString(filters) {
        if (!filters) {
            return ''
        }
        let queryParams = [];
        for (var key in filters) {
            if (key == 'id') {
                queryParams.push(`uuid=${filters[key]}`)
            } else {
                queryParams.push(`${key}=${filters[key]}`)
            }
        }
        return queryParams.join('&');
    }
    async volumeBoot(data) {
        let resp = await axios.post('/computing/os-volumes_boot', { server: data });
         return resp.data;
    }
    async imageBoot(data) {
        let resp = await axios.post('/computing/servers', { server: data });
        return resp.data;
    }
    async boot(name, flavorId, imageId, options = {}) {
        let data = {
            name: name, flavorRef: flavorId,
            max_count: options.minCount || 1,
            min_count: options.maxCount || 1
        };
        if (!options.networks) {
            data.networks = 'none';
        } else {
            data.networks = options.networks;
        }
        if (options.password && options.password != '') {
            let userData = [
                '#cloud-config',
                'chpasswd:',
                '  list: |',
                '    root:' + options.password.trim(),
                '  expire: False',
                '']
            data.user_data = window.btoa(userData.join('\n'));
        }
        if (options.az && options.az != '') {
            data.availability_zone = options.az;
            if (options.host && options.host != '') {
                data.availability_zone += `:${options.host}`;
            }
        }
        if (options.keyName){ data.key_name = options.keyName }
        if (options.useBdm) {
            data.block_device_mapping_v2 = [{
                boot_index: 0, source_type: 'image', destination_type: "volume",
                delete_on_termination: true,
                volume_size: options.volumeSize, uuid: imageId,
            }];
            if (options.volumeType){
                data.block_device_mapping_v2[0].volume_type = options.volumeType;
            }
        } else {
            data.imageRef = imageId
        }
        LOG.debug(`Boot server with data ${JSON.stringify(data)}`)
        if (options.useBdm) {
            return await this.volumeBoot(data);
        } else {
            return await this.imageBoot(data);
        }
    }
    async update(id, data){
        let resp = await this.put(id, {server: data});
        return resp.data;
    }
    async getVncConsole(id, type='novnc') {
        let resp = await axios.post(`${this.baseUrl}/${id}/remote-consoles`,
                                    { remote_console: { type: type, protocol: "vnc" } });
        return resp.data;
    }
    async stop(id) {
        let resp = await this.doAction(id, { 'os-stop': null });
        return resp.data;
    }
    async start(id) {
        let resp = await this.doAction(id, { 'os-start': null })
        return resp.data;
    }
    async reboot(id, type = 'SOFT') {
        let resp = await this.doAction(id, { 'reboot': { type: type } })
        return resp.data;
    }
    async pause(id) {
        let resp = await this.doAction(id, {'pause': null});
        return resp.data;
    }
    async unpause(id){
        let resp = await this.doAction(id, {'unpause': null});
        return resp.data;
    }

    async attachVolume(id, volumeId) {
        let resp = await axios.post(`${this.baseUrl}/${id}/os-volume_attachments`,
                                    { volumeAttachment: { volumeId: volumeId } });
        return resp.data;
    }
    async volumeAttachments(id) {
        let resp = await axios.get(`${this.baseUrl}/${id}/os-volume_attachments`);
        return resp.data;
    }
    async volumeDetach(id, volumeId) {
        let resp = await axios.delete(`${this.baseUrl}/${id}/os-volume_attachments/${volumeId}`);
        return resp.data;
    }
    async interfaceList(id) {
        let resp = await axios.get(`${this.baseUrl}/${id}/os-interface`);
        return resp.data;
    }
    async interfaceAttach(id, vif) {
        // NOTE vif e.g. {net_id: <netId>} or {port_id: <portId>}
        let resp = await axios.post(`${this.baseUrl}/${id}/os-interface`, { 'interfaceAttachment': vif });
    }
    async interfaceDetach(id, portId) {
        let resp = await axios.delete(`${this.baseUrl}/${id}/os-interface/${portId}`);
        return resp.data;;
    }
    async doAction(id, body) {
        let resp = await axios.post(`${this.baseUrl}/${id}/action`, body);
        return resp.data;
    }
    async changePassword(id, password, userName = null) {
        let data = { adminPass: password }
        if (userName) { data.userName = userName; }
        let resp = await this.doAction(id, { changePassword: data });
        return resp.data;
    }
    async resize(id, flavor_id) {
        return this.doAction(id, { resize: { flavorRef: flavor_id } })
    }
    async liveMigrate(id) {
        let data = { block_migration: "auto", host: null }
        return this.doAction(id, { 'os-migrateLive': data })
    }
    async migrate(id) {
        return this.doAction(id, { migrate: {} })
    }
    async rebuild(id, options={}){
        let data = {description: null}
        for(let key in options){
            if (options[key]){
                data[key] = options[key]
            }
        }
        return this.doAction(id, {rebuild: data})
    }
    async actionList(id) {
        return (await this.get(`/${id}/os-instance-actions`)).instanceActions
    }
    async actionShow(id, reqId) {
        return (await this.get(`/${id}/os-instance-actions/${reqId}`)).instanceAction
    }
}

class Endpoint extends Restfulclient {
    constructor() { super('/identity/endpoints') };
    // interface=public
}

class Service extends Restfulclient {
    constructor() { super('/identity/services') };
    // interface=public
}

class User extends Restfulclient {
    constructor() { super('/identity/users') };
}

class Image extends Restfulclient {
    constructor() { super('/image/v2/images') };
}

class Network extends Restfulclient {
    constructor() { super('/networking/v2.0/networks') };
}
class Subnet extends Restfulclient {
    constructor() { super('/networking/v2.0/subnets') };
}
class Port extends Restfulclient {
    constructor() { super('/networking/v2.0/ports') };
}
class Router extends Restfulclient {
    constructor() { super('/networking/v2.0/routers'), this.portClient = new Port() };
    // interface=public
    async listInterface(id) {
        return (await this.portClient.list({ device_id: id })).ports
    }
    async addInterface(id, subnet_id) {
        return await this.put(`${id}/add_router_interface`, { subnet_id: subnet_id })
    }
    async removeSubnet(id, subnet_id) {
        return await this.put(`${id}/remove_router_interface`, { subnet_id: subnet_id })
    }
}
class Volume extends ClientExt {
    constructor() { super('/volume/volumes') };
    async create(data) { return this.post({ volume: data }) }

    async waitVolumeStatus(volume_id, expectStatus=['available', 'error']) {
        let body = {}
        while (true){
            body = await API.volume.get(volume_id);
            let status = body.volume.status;
            LOG.debug(`wait volume ${volume_id} status to be ${expectStatus}, now: ${status}`)
            if (expectStatus.indexOf(status) >= 0) {
                break;
            }
            await Utils.sleep(3);
        }
        return body
    }
}
class Snapshot extends ClientExt {
    constructor() { super('/volume/snapshots') };
    async create(data) { return this.post({ snapshot: data }) }

    async waitSnapshotStatus(snapshot_id, expectStatus=['available', 'error']){
        let snapshot = {};
        while (true){
            snapshot = (await API.snapshot.get(snapshot_id)).snapshot;
            LOG.debug(`wait snapshot ${snapshot_id} status to be ${expectStatus}, now: ${snapshot.status}`)
            if (expectStatus.indexOf(snapshot.status) >= 0) {
                break;
            }
            await Utils.sleep(3);
        }
        return snapshot
    }
}
class Backup extends ClientExt {
    constructor() { super('/volume/backups') };
    async create(data) { return this.post({ backup: data }) }
}
class VolumeService extends Restfulclient {
    constructor() { super('/volume/os-services') };
    async enable(binary, host){
        return this.put(`/enable`, {binary: binary, host: host })
    }
    async disable(binary, host){
        return this.put(`/disable`, {binary: binary, host: host })
    }
}
class VolumeType extends Restfulclient {
    constructor() { super('/volume/types') };
    async create(data){
        return (await this.post({volume_type: data})).volume_type;
    }
}

class Cluster extends Restfulclient {
    constructor() { super('/cluster') };

    async add(data) {
        return this.post({ cluster: data })
    }
}


export class OpenstackProxyApi {
    constructor() {
        // keystone
        this.service = new Service();
        this.endpoint = new Endpoint();
        this.user = new User();
        // nova
        this.hypervisor = new Hypervisor();
        this.flavor = new Flavor();
        this.az = new AZ();
        this.computeService = new ComputeService();
        this.server = new Server();
        this.usage = new Usage();
        this.keypair = new Keypair();
        // glance
        this.image = new Image();
        // neutron
        this.router = new Router();
        this.network = new Network();
        this.subnet = new Subnet();
        this.port = new Port();
        // cinder
        this.volume = new Volume();
        this.volumeType = new VolumeType();
        this.snapshot = new Snapshot();
        this.backup = new Backup();
        this.volumeService = new VolumeService();

        this.cluster = new Cluster();
    }
}


const API = new OpenstackProxyApi();

export default API;
