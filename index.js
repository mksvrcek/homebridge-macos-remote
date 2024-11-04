"use strict";

var Service, Characteristic, HomebridgeAPI;
const { HomebridgeDummyVersion } = require('./package.json');


module.exports = function (api) {
  api.registerPlatform('mac-remote-platform', MacRemotePlatform)
}

class MacRemotePlatform {
    constructor(log, config, api) {
        this.accessories = [];
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        
        this.connections = [];

        log.debug("Loading Mac Remote Platform...");
      
        api.on('didFinishLaunching', () => {
            const currentAccessoryUUIDs = [];
            
            config.computers?.forEach((computer) => {
                this.log("Initializing " + computer.name);
                const uuid = api.hap.uuid.generate(computer.id);
                currentAccessoryUUIDs.push(uuid);
                
                if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
                      const platform = new api.platformAccessory(computer.name, uuid);
                      api.registerPlatformAccessories('@theproductroadmap/homebridge-macos-remote', config.name, [platform])
                      this.accessories.push(platform)
                      this.connections[computer.id] = new MacRemoteControl(config.id, this.log, this.config, this.api, platform)
                    } else {
                      let platform = this.accessories.find(accessory => accessory.UUID === uuid);
                      this.connections[computer.id] = new MacRemoteControl(config.id, this.log, this.config, this.api, platform)
                }
            });
            
            const WebSocket = require('ws');
            const wss = new WebSocket.Server({ port: 8070 });
            
            wss.on('connection', ws => {
                this.log('Client connected');
                this.connections.push(ws);
            
                ws.on('message', message => {
                 if (`${message}`.startsWith('auth:')) {
                    const id = `${message}`.split(':')[1];
                    this.log.debug(`Received connection from ID: ${id}`);
            
                    if (!this.connections[id]) {
                        this.log(`Insert '${id}' to your config to add this device.`);
                    } else {
                        this.connections[id].updateConnection(ws);
                    }
                 }
                });
            
                ws.on('close', () => {
                  this.log('Client disconnected');
                });
              });
            
              this.log('WebSocket server running on ws://localhost:8070');
        });
        
    }
    configureAccessory(accessory) {
        this.log.debug("Found cached accessory:" + accessory.UUID)
        this.accessories.push(accessory);
    }
}



class MacRemoteControl {
    constructor(id, log, config, api, platform) {
        this.id = id;
        this.log = log;
        this.config = config;
        this.api = api;
        this.platform = platform;
        
        
        this.lockRepresentative = platform.getService(config.name)
        if (this.config.lock) {
            if (!this.timerRepresentative) {
              log.debug("Created service: " + 'Dummy-Timer-' + config.name.replace(/\s/g, '-'))
              this.timerRepresentative = platform.addService(api.hap.Service.LockMechanism, config.name, 'lock')
            }
        }
    }
}


MacRemoteControl.prototype.updateConnection = function(newWs) {
    this.log("New connection for ID:", this.id)
    this.ws = newWs;
    this.ws.on('message', (message) => this._handleMessage(message));
}

MacRemoteControl.prototype._handleMessage = function(message) {
    this.debug("Received:", message)
}
















// module.exports = function(homebridge) {

//   Service = homebridge.hap.Service;
//   Characteristic = homebridge.hap.Characteristic;
//   HomebridgeAPI = homebridge;
//   homebridge.registerAccessory("homebridge-macos-remote", "MacOSRemoteSwitch", MacOSRemoteSwitch);
// }


// function MacOSRemoteSwitch(log, config) {
//   this.log = log;
//   this.name = config.name;
//   this.port = config.port;
//   this.disableLogging = false;

//   this.lock = config.lock || true;
//   if (this.lock) {
//     this._service = new Service.LockMechanism(this.name);
// 		this.modelString = "MacOS Lock";
//   }

//   this.informationService = new Service.AccessoryInformation();
//   this.informationService
//       .setCharacteristic(Characteristic.Manufacturer, 'Homebridge')
//       .setCharacteristic(Characteristic.Model, this.modelString)
//       .setCharacteristic(Characteristic.FirmwareRevision, HomebridgeDummyVersion)
//       .setCharacteristic(Characteristic.SerialNumber, 'MACOS-' + this.name.replace(/\s/g, '-'));
  
//   if (this.lock) {
//     this._service.getCharacteristic(Characteristic.LockTargetState)
//         .on('set', this._setValue.bind(this));

//     this._service.setCharacteristic(Characteristic.LockCurrentState, 0);
//     this._service.setCharacteristic(Characteristic.LockTargetState, 0);
//   }

// this.log("hey")
//   this._wsserver()
// }

// MacOSRemoteSwitch.prototype.getServices = function() {
//   return [this.informationService, this._service];
// }

// MacOSRemoteSwitch.prototype._wsserver = function() {
//   var isLocked = false;
// this.log("working?")
//   const WebSocket = require('ws');

//   const wss = new WebSocket.Server({ port: 8070 });

//   wss.on('connection', ws => {
//     this.log('Client connected');

//     ws.on('message', message => {
        
//       this.log(`Received: ${message}`);
//       ws.send(`received:${message}`);
        
//       if (message.includes(":")) {
//           const [command, ...args] = `${message}`.split(':');
//           if (command === 'mac-lock') {
//             const lockState = args[0] === 'true';
//             isLocked = lockState;
//             this._service.setCharacteristic(Characteristic.LockCurrentState, lockState ? 1 : 0);
//             this._service.setCharacteristic(Characteristic.LockTargetState, lockState ? 1 : 0);
//           }
//       }
//     });
    
//     this.triggerShortcut = function(name) {
//         this.log("Running shortcut:", name)
//         ws.send(`shortcut:${name}`)
//     }

//     ws.on('close', () => {
//       this.log('Client disconnected');
//     });
//   });

//   this.log('WebSocket server running on ws://localhost:8070');
// }

// MacOSRemoteSwitch.prototype._setValue = function(value, callback) {
//     if (value == 1) {
//         if (this.triggerShortcut) {
//             this.triggerShortcut("MACLOCK");
//             this._service.setCharacteristic(Characteristic.LockCurrentState, value);
//         }
//     } else {
//         this._service.setCharacteristic(Characteristic.LockTargetState, 0);
//     }
    
    
//   // if (value == 1) {
//   //   // this._service.setCharacteristic(Characteristic.LockTargetState, 0);
//   // } else {
//   //   const options = {
//   //     hostname: this.ip,
//   //     port: this.port,
//   //     path: '/shortcut/MACLOCK',
//   //     method: 'GET'
//   //   };
  
//   //   const req = this.http.request(options, (res) => { });
//   // }
//   callback();
// }











// function randomize(time) {
//   return Math.floor(Math.random() * (time + 1));
// }

// MacOSRemoteSwitch.prototype._getBrightness = function(callback) {

//   if ( ! this.disableLogging ) {
// 	this.log("Getting " + "brightness: " + this.brightness);
//   }

//   callback(null, this.brightness);
// }

// MacOSRemoteSwitch.prototype._setBrightness = function(brightness, callback) {

//   if ( ! this.disableLogging ) {
// 	var msg = "Setting brightness: " + brightness
// 	this.log(msg);
//   }

//   this.brightness = brightness;
//   this.storage.setItemSync(this.brightnessStorageKey, brightness);

//   callback();
// }

// MacOSRemoteSwitch.prototype._setOn = function(on, callback) {

//   var delay = this.random ? randomize(this.time) : this.time;
//   var msg = "Setting switch to " + on
//   if (this.random && !this.stateful) {
//       if (on && !this.reverse || !on && this.reverse) {
//         msg = msg + " (random delay " + delay + "ms)"
//       }
//   }
//   if( ! this.disableLogging ) {
//       this.log(msg);
//   }

//   if (on && !this.reverse && !this.stateful) {
//     if (this.resettable) {
//       clearTimeout(this.timer);
//     }
//     this.timer = setTimeout(function() {
//       this._service.setCharacteristic(Characteristic.On, false);
//     }.bind(this), delay);
//   } else if (!on && this.reverse && !this.stateful) {
//     if (this.resettable) {
//       clearTimeout(this.timer);
//     }
//     this.timer = setTimeout(function() {
//       this._service.setCharacteristic(Characteristic.On, true);
//     }.bind(this), delay);
//   }
  
//   if (this.stateful) {
// 	this.storage.setItemSync(this.name, on);
//   }
  
//   callback();
// }
