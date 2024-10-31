"use strict";

var Service, Characteristic, HomebridgeAPI;
const { HomebridgeDummyVersion } = require('./package.json');

module.exports = function(homebridge) {

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HomebridgeAPI = homebridge;
  homebridge.registerAccessory("homebridge-macos-remote", "MacOSRemoteSwitch", MacOSRemoteSwitch);
}


function MacOSRemoteSwitch(log, config) {
  this.log = log;
  this.name = config.name;
  this.ip = config.ip;
  this.port = config.port;
  this.disableLogging = false;
  this.pollingrate = 10000;

  this.lock = config.lock || true;
  if (this.lock) {
    this._service = new Service.LockMechanism(this.name);
		this.modelString = "MacOS Lock";
  }

  this.informationService = new Service.AccessoryInformation();
  this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Homebridge')
      .setCharacteristic(Characteristic.Model, this.modelString)
      .setCharacteristic(Characteristic.FirmwareRevision, HomebridgeDummyVersion)
      .setCharacteristic(Characteristic.SerialNumber, 'MACOS-' + this.name.replace(/\s/g, '-'));
  
  this.cacheDirectory = HomebridgeAPI.user.persistPath();
  this.storage = require('node-persist');
  this.http = require('http');
  this.storage.initSync({dir:this.cacheDirectory, forgiveParseErrors: true});
  
  if (this.lock) {
    this._service.getCharacteristic(Characteristic.LockTargetState)
        .on('set', this._setValue.bind(this));

    this._service.setCharacteristic(Characteristic.LockTargetState, 0);
  }

  if (this.pollingrate > 0) {
    setInterval(this._updateState.bind(this), this.pollingrate);
  }
}

MacOSRemoteSwitch.prototype.getServices = function() {
  return [this.informationService, this._service];
}

MacOSRemoteSwitch.prototype._updateState = function() {
  const options = {
    hostname: this.ip,
    port: this.port,
    path: '/islocked',
    method: 'GET'
  };

  const req = this.http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(data);
          const status = response.status;
          // this._service.setCharacteristic(Characteristic.StatusFault, 0);
          this._service.setCharacteristic(Characteristic.LockTargetState, status ? 1 : 0);
        } catch (e) {
          this.log('Error parsing response:', e);
        }
      } else if (res.statusCode === 404) {
        this._service.setCharacteristic(Characteristic.LockTargetState, 0);
        // this._service.setCharacteristic(Characteristic.StatusFault, 1);
        this.log('Error 404: Not Found');
      } else {
        this.log('Error:', res.statusCode);
      }
    });
  });

  req.on('error', (e) => {
    this.log('Request error:', e);
  });

  req.end();
}

MacOSRemoteSwitch.prototype._setValue = function(value, callback) {
  if (value == 1) {
    // this._service.setCharacteristic(Characteristic.LockTargetState, 0);
  } else {
    this._service.setCharacteristic(Characteristic.LockTargetState, 1);
    const options = {
      hostname: this.ip,
      port: this.port,
      path: '/shortcut/MACLOCK',
      method: 'GET'
    };
  
    const req = this.http.request(options, (res) => {});
  }
  callback();
}











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
