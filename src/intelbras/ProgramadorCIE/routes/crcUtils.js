var crcLib = require("crc");

const CRCUtils = {
  crc16: function (buffer) {
    var calculedCRC = crcLib.crc16modbus(buffer);
    var crcBuffer = Buffer.alloc(2);
    crcBuffer.writeUInt16BE(calculedCRC, 0);
    return crcBuffer;
  },
  concatCRC: function (buffer) {
    var crc;
    if (typeof buffer !== "Buffer") {
      buffer = new Buffer(buffer);
    }
    if (buffer.length && buffer[0] === 0) {
      crc = this.crc16(buffer.slice(1, buffer.length));
    } else {
      crc = this.crc16(buffer);
    }
    return Buffer.concat([new Uint8Array(buffer), crc]);
  },
  makeFrameStart(command) {
    var index = 1;
    var length = 0;
    var frame = [0, command, 0];
    return this.concatCRC([...frame, index, length]);
  },
  makeFrameRequest(data, command, nextCommand, secondByte, thirdByte) {
    let frameCommand = [0, command, data[2]];
    let frameNextCommand = [0, nextCommand, 0];
    if (data.length && data.length === 128) {
      if (data[1] == 1) {
        return frameNextCommand;
      } else {
        return frameCommand;
      }
    } else {
      var index = data[128];
      var length = data[129];
      if (index === length) {
        index = 1;
        length = 0;
        frameNextCommand[2] =
          secondByte !== undefined ? secondByte : data[2] + 1;
        thirdByte && (frameNextCommand[3] = thirdByte);
        return this.concatCRC([...frameNextCommand, index, length]);
      } else {
        index++;
        return this.concatCRC([...frameCommand, index, length]);
      }
    }
  },
  read16: function (frame, position) {
    return Buffer.from(frame.slice(position, position + 2)).readUInt16BE();
  },
  write16: function (number) {
    const dataBuffer = new Buffer(2);
    dataBuffer.writeUInt16BE(number, 0);
    return dataBuffer;
  },
};

module.exports = CRCUtils;
