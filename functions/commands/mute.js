const DefaultCommand = require('./default.js');
const TV = require('../devices/tv.js');
const { ERROR_CODES, GoogleAssistantError } = require('../googleErrorCodes.js');

class Mute extends DefaultCommand {
  static get type() {
    return 'action.devices.commands.mute';
  }

  static validateParams(params) {
    return 'mute' in params && typeof params.mute === 'boolean';
  }

  static getItemName(device) {
    if (TV.isMediaGroupDevice(this.getDeviceType(device))) {
      const members = this.getMembers(device);
      if ('tvMute' in members) {
        return members.tvMute;
      }
      if ('tvVolume' in members) {
        return members.tvVolume;
      }
      throw new GoogleAssistantError(ERROR_CODES.NOT_SUPPORTED, 'Device has no tvMute or tvVolume member configured');
    }
    return device.id;
  }

  static convertParamsToValue(params, item, device) {
    let itemType = this.getItemType(device);
    if (TV.isMediaGroupDevice(this.getDeviceType(device))) {
      const members = this.getMembers(device);
      if ('tvMute' in members) {
        itemType = 'Switch';
      }
    }
    let mute = params.mute;
    if (itemType !== 'Switch') {
      return mute ? '0' : null;
    }
    if (this.isInverted(device)) {
      mute = !mute;
    }
    return mute ? 'ON' : 'OFF';
  }

  static getResponseStates(params) {
    return {
      isMuted: params.mute
    };
  }
}

module.exports = Mute;
