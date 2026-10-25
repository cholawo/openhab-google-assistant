const TV = require('./tv.js');

class AudioVideoReceiver extends TV {
  static get type() {
    return 'action.devices.types.AUDIO_VIDEO_RECEIVER';
  }

  static getTraits(item) {
    return super.getTraits(item).filter((trait) => trait !== 'action.devices.traits.Channel');
  }
}

module.exports = AudioVideoReceiver;
