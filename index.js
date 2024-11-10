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
                      api.registerPlatformAccessories('@theproductroadmap/homebridge-macos-remote', config.name + " platform", [platform])
                      this.accessories.push(platform)
                      this.connections[computer.id] = new MacRemoteControl(config.id, this.log, computer, this.api, platform)
                    } else {
                      let platform = this.accessories.find(accessory => accessory.UUID === uuid);
                      this.connections[computer.id] = new MacRemoteControl(config.id, this.log, computer, this.api, platform)
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
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
          
          
        if (Array.isArray(this.config.shortcuts) && this.config.shortcuts.length > 0) {
          this.config.shortcuts.forEach((shortcut) => {
              
              const uuid = this.api.hap.uuid.generate(shortcut.name);
              var ss = new this.Service.Outlet(shortcut.name, uuid, shortcut.name)
              
              var shortcutSwitch = platform.getService(ss)
              if (!shortcutSwitch) {
                  this.log("Creating Shortcut: " + shortcut.name)
                //   shortcutSwitch = platform.addService(this.Service.Outlet, shortcut.name, shortcut.name)
                shortcutSwitch = platform.addService(ss)
              }
              
              shortcutSwitch.setCharacteristic(this.Characteristic.ConfiguredName, shortcut.name);
            //   shortcutSwitch.removeCharacteristic(this.Characteristic.Name)
            //   shortcutSwitch.setCharacteristic(this.Characteristic.Name, "mksvrcek")
            //   this.log(shortcutSwitch.getCharacteristic(this.Characteristic.Name).value)
            //   shortcutSwitch.addCharacteristic(this.Characteristic.Name)
            //         .updateValue("yofdasfasd")
                    
                // shortcutSwitch.updateCharacteristic(this.Characteristic.Name, "lallala")
                // this.log(shortcutSwitch.getCharacteristic(this.Characteristic.Name))
              
              shortcutSwitch.getCharacteristic(this.Characteristic.On)
                // .onGet(this.handleOnGet.bind(this))
                .on('get', (callback) => {
                    const value = shortcutSwitch.getCharacteristic(this.Characteristic.On).value;
                    callback(null, value);
                  })
                .onSet(function (value) {
                    if (value == true) {
                        this.triggerShortcut(shortcut.name)
                        var timer = setTimeout(function() {
                            this.log("reset")
                            shortcutSwitch.setCharacteristic(this.Characteristic.On, false)
                        }.bind(this), 1000);
                    } else {
                        shortcutSwitch.getCharacteristic(this.Characteristic.On)
                                .updateValue(false)
                    }
                }.bind(this));
          });
        }
        
        if (this.config.lock) {
            this.lockRepresentative = platform.getService(config.name)
            this.log("Lock enabled")
            if (!this.lockRepresentative) {
              this.log("Created service: " + '' + config.name.replace(/\s/g, '-'))
              this.lockRepresentative = platform.addService(api.hap.Service.LockMechanism, config.name, 'lock')
            }
        }
        
        if (this.config.lock) {
            this.lockRepresentative.getCharacteristic(this.Characteristic.LockTargetState)
                .on('set', this._setValue.bind(this));
        
            this.lockRepresentative.setCharacteristic(this.Characteristic.LockCurrentState, 0);
            this.lockRepresentative.setCharacteristic(this.Characteristic.LockTargetState, 0);
          }
    }
}


MacRemoteControl.prototype.updateConnection = function(newWs) {
    this.log("New connection for ID:", this.id)
    this.ws = newWs;
    this.ws.on('message', (message) => this._handleMessage(message));
    this.ws.on('close', () => {
        this.ws = null;
        this.lockRepresentative.updateCharacteristic(this.Characteristic.LockCurrentState, new Error('A placeholder error object'));
    })
}

MacRemoteControl.prototype._handleMessage = function(message) {
    this.log.debug("Received:", message)
    
      this.ws.send(`received:${message}`);
        
      if (message.includes(":")) {
          const [command, ...args] = `${message}`.split(':');
          if (command === 'mac-lock' && this.config.lock) {
            const lockState = args[0] === 'true';
            this.isLocked = lockState;
            this.lockRepresentative.setCharacteristic(this.Characteristic.LockCurrentState, lockState ? 1 : 0);
            this.lockRepresentative.setCharacteristic(this.Characteristic.LockTargetState, lockState ? 1 : 0);
          }
      }
}

MacRemoteControl.prototype.triggerShortcut = function(name) {
    if (this.ws) {
        this.log("Running shortcut:", name)
        this.ws.send(`shortcut:${name}`)
    }
}

MacRemoteControl.prototype._setValue = function(value, callback) {
    if (this.ws != null) {
        if (value == 1) {
        //     if (this.triggerShortcut) {
                this.triggerShortcut("MACLOCK");
                // this.lockRepresentative.setCharacteristic(this.Characteristic.LockCurrentState, value);
                // this.lockRepresentative.getCharacteristic(this.Characteristic.LockCurrentState)
                //     .updateValue(value);
        //     }
        } else {
            this.lockRepresentative.updateCharacteristic(this.Characteristic.LockTargetState, 0);
            // this.lockRepresentative.updateValue(0);
        }
    } else {
        this.lockRepresentative.updateCharacteristic(this.Characteristic.LockCurrentState, new Error('A placeholder error object'));
        this.log("Mac connection not active")
    }
    
    callback();
}


MacRemoteControl.prototype.getServices = function() {
  return [this.informationService, this._service];
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
