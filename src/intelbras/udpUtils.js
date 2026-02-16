var CONFIG = require("./udpConfig");
var dgram = require("dgram");
var crypto = require("crypto");

var keys = CONFIG.CRYPTO.keys;

var Cypher = {
  rvSeqnum: 0,
  snSeqnum: 1,
  setCounters: function (rv, sn) {
    if (rv > Cypher.rvSeqnum) {
      if (rv - Cypher.rvSeqnum > CONFIG.CRYPTO.seqNumRecvWin / 2) {
        Cypher.rvSeqnum = rv;
      }
    } else {
      if (Cypher.rvSeqnum - rv > CONFIG.CRYPTO.seqNumRecvWin / 2) {
        Cypher.rvSeqnum = rv;
      }
    }
    if (sn > Cypher.snSeqnum) {
      if (sn - Cypher.snSeqnum > CONFIG.CRYPTO.seqNumRecvWin / 2) {
        Cypher.snSeqnum = sn;
      }
    } else {
      if (Cypher.snSeqnum - sn > CONFIG.CRYPTO.seqNumRecvWin / 2) {
        Cypher.snSeqnum = sn;
      }
    }
  },
  crypt: function (data) {
    //------------------------------------------------------------------------------------------------------------
    // For low memory usage and fast processing there is 2 options for encryption:
    // 1) Get cipher output (with update()) join them along with IV and save in a new buffer
    //   (this will temporarily duplicate buffer in memory, but it is faster)
    //   Note: '+' with strings is said to be way faster than Buffer.concat or Array.join.
    //   However buffers must be converted to strings, which is not working and slow down process
    // 2) Create a buffer for cipher | IV | MAC. Loop getting partial cipher output (with update()) and
    //   copy to buffer. This saves some memory but it is slower

    // Using option 1) will use more memory but will be faster.

    // Note: Buffers can't be resized. A new one is created if more space is required.

    //--------------------------------
    // Create IV. Generate random + fill zeros
    var iv = Buffer.concat([crypto.randomBytes(8), new Buffer.alloc(8).fill(0)]);
    // Alternative: Duplicate IV 8 bytes
    //var rand = crypto.randomBytes(8)
    //var iv = Buffer.concat([rand, rand])

    //--------------------------------
    // Get sequence number
    var seqnum = Cypher.snSeqnum;

    //--------------------------------
    // Replace with fixed values (for test only)
    //iv = Buffer.concat([IvTest, new Buffer.alloc(8).fill(0)])
    //data = DataTest
    //seqnum = SeqNumTest

    //--------------------------------
    // Prepare seq. number
    var snbuf = new Buffer.alloc(2);
    snbuf.writeUInt16BE(seqnum, 0);

    //--------------------------------
    // Create for encrypt CBC-AES-256. Padding: Allow default Auto Padding (PKCS).
    var cipher = crypto.createCipheriv("aes-256-cbc", keys.cbcEnc, iv);
    // Encrypt (adds seqnum in plain data). Concat ciphered data with IV (last 8 bytes = zeros)
    var encdata = Buffer.concat([
      cipher.update(data),
      cipher.update(snbuf),
      cipher.final(),
      iv,
    ]);

    //------------------------------------------------------------------------------------------------------------

    // For low memory usage and fast processing there is 2 options for encryption:
    // 1) Join cipher output (with update()) in a new buffer and use only 8 last bytes.
    //   (this will temporarily duplicate buffer in memory, but it is faster)
    // 2) Loop for processing. At the end, get last output buffer (16 bytes). use only last 8 bytes.

    // Using option 1) will use more memory but will be faster.

    //----------------------------------------
    // Create for HMAC-CBC-AES-256. IV = zeros. No padding (already aligned)
    iv.fill(0);
    var hmacCipher = crypto
      .createCipheriv("aes-256-cbc", keys.cbcMac, iv)
      .setAutoPadding(false);

    //----------------------------------------
    // Option 1)
    var hmacBuf = Buffer.concat([
      hmacCipher.update(encdata),
      hmacCipher.final(),
    ]);

    //----------------------------------------
    // Option 2)
    /*
        var datalen = encdata.length - 16
        for (var idx = 0 idx < datalen idx += 16) {
         hmacCipher.update(encdata.slice(idx, idx + 16))
        }
        var hmacBuf = Buffer.concat([hmacCipher.update(encdata.slice(idx, idx + 16)), hmacCipher.final()])
        */

    //----------------------------------------
    // Encrypt-last-block
    var hmacEncCipher = crypto
      .createCipheriv("aes-256-cbc", keys.cbcMacEnc, iv)
      .setAutoPadding(false);
    var hmacEncBuf = Buffer.concat([
      hmacEncCipher.update(hmacBuf.slice(hmacBuf.length - 16)),
      hmacEncCipher.final(),
    ]);

    //----------------------------------------
    // Copy HMAC to end of buffer
    hmacEncBuf.copy(encdata, encdata.length - 8, hmacEncBuf.length - 8);

    //------------------------------------------------------------------------------------------------------------
    // Increment sequence number and wraparound
    Cypher.snSeqnum++;
    if (Cypher.snSeqnum == 65536) Cypher.snSeqnum = 0;

    return encdata;
  },
  decrypt(encdata) {
    var enclen = encdata.length;
    var seqNumRecvWin = CONFIG.CRYPTO.seqNumRecvWin;

    // Check if size is multiple of 16 and check minimum size of 32
    if (enclen % 16 || enclen < 32) {
      // Size Error
      return { error: CONFIG.ERRORS.FAIL_DECRYPT };
    }

    //--------------------------------
    // Extract HMAC
    var hmac = new Buffer.from(encdata.slice(enclen - 8, enclen));

    //--------------------------------
    // Fill last 8 bytes with zeros
    encdata.fill(0, enclen - 8, enclen);
    // Alternative: Duplicate IV 8 bytes
    //encdata.copy(encdata, enclen - 8, enclen - 16, enclen - 8)

    //--------------------------------
    // Create HMAC-CBC-AES-256
    var iv = new Buffer.alloc(16).fill(0);
    var hmacCipher = crypto
      .createCipheriv("aes-256-cbc", keys.cbcMac, iv)
      .setAutoPadding(false);
    var hmacBuf = Buffer.concat([
      hmacCipher.update(encdata),
      hmacCipher.final(),
    ]);
    // Encrypt-last-block
    var hmacEncCipher = crypto
      .createCipheriv("aes-256-cbc", keys.cbcMacEnc, iv)
      .setAutoPadding(false);
    var hmacEncBuf = Buffer.concat([
      hmacEncCipher.update(hmacBuf.slice(hmacBuf.length - 16)),
      hmacEncCipher.final(),
    ]);

    //--------------------------------
    // Compare
    var hmaclen = hmacEncBuf.length;
    var cmp = hmac.equals(hmacEncBuf.slice(hmaclen - 8, hmaclen));

    if (!cmp) {
      // HMAC Error
      return { error: CONFIG.ERRORS.FAIL_DECRYPT };
    }

    //------------------------------------------------------------------------------------------------
    // Decrypt CBC-AES-256

    //--------------------------------
    // Create for decrypt CBC-AES-256.
    // IV is used directly from input buffer (already filled)
    var decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      keys.cbcEnc,
      encdata.slice(enclen - 16, enclen)
    );
    // Decrypt
    var plaindata = Buffer.concat([
      decipher.update(encdata.slice(0, enclen - 16)),
      decipher.final(),
    ]);

    //--------------------------------
    // Check received sequence number
    // Position
    var seqoff = plaindata.length - 2;
    // Value
    var seqnum = plaindata.readUInt16BE(seqoff);
    var diff, diff1;

    /*if (seqnum >= Cypher.rvSeqnum) {
            diff = seqnum - Cypher.rvSeqnum;
        } else {
            diff = Cypher.rvSeqnum - seqnum;
        }

        if (seqnum >= Cypher.snSeqnum) {
            diff1 = seqnum - Cypher.snSeqnum;
        } else {
            diff1 = Cypher.snSeqnum - seqnum;
        }

        // unsigned 16bit subtraction of received and stored sequence number
        if (diff < 0) {
            // subtraction considering 16bit wraparound
            diff += 65536;
        }

        if (diff1 < 0) {
            // subtraction considering 16bit wraparound
            diff1 += 65536;
        }

        // Windows checking. Only 100 values ahead are accepted
        if (diff > seqNumRecvWin && diff1 > seqNumRecvWin) {
            // Sequence number within 100 last used values
            return { data: plaindata.slice(0, seqoff), error: CONFIG.ERRORS.FAIL_COUNTER };
        }*/

    // Resync sequence number
    // Cypher.rvSeqnum = seqnum;

    //--------------------------------
    // Return
    return { data: plaindata.slice(0, seqoff) };
  },
};

var UdpUtils = {
  cypher: Cypher,
  genericMessage: function (command, buffer) {
    var message = new Uint8Array([command]);
    for (var i = 0; i < buffer.length; i++) {
      var bufUint = Buffer.allocUnsafe(2);
      bufUint.writeUInt16LE(buffer[i]);
      message = UdpUtils.concatenateBuffer(message, bufUint);
    }
    return message;
  },
  concatenateBuffer: function (buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp;
  },
  identifyControl: 1,
  generateMessageIdentify: function () {
    var buferIdentify = Buffer.allocUnsafe(4);
    try {
      this.identifyControl++;
      buferIdentify.writeUInt32LE(this.identifyControl);
    } catch (e) {
      this.identifyControl = 1;
      buferIdentify.writeUInt32LE(this.identifyControl);
    }
    return buferIdentify;
  },
  extractMessageIndentify: function (data, type) {
    let identify = "";
    let identifyStart = 5,
      identifyEnd = 9;
    if (type === "RECEIVED") {
      identifyStart = 1;
      identifyEnd = 5;
    }
    for (var byte of new Uint8Array(data.slice(identifyStart, identifyEnd))) {
      identify += byte.toString();
    }
    return identify;
  },
  extractMessageData: function (data) {
    return data.slice(5);
  },
  closeSocket: function (socket) {
    try {
      if (socket) socket.close();
    } catch (e) {
      ////console.log(e);
    }
  },
  getLocalIp: function () {
    var os = require("os");
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
      for (var k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family === "IPv4" && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    var regex = process.env.CIE_IFACE_REGEX
      ? new RegExp(process.env.CIE_IFACE_REGEX)
      : /^192\.168\.0\./; // ← ajuste para sua LAN
    var filtered = addresses.filter(ip => regex.test(ip));
    //console.log(filtered.length ? filtered : addresses); // mantém o log do original
    return filtered.length ? filtered : addresses;
  },
  createSocket: async function (port) {
    try {
      return new Promise((accept, reject) => {
        var socket = dgram.createSocket({
          type: "udp4",
          reuseAddr: true,
        });

        socket.unref?.();

        socket.once('error', (err) => {
          socket.__closed = true;
          try { socket.close(); } catch { }
          reject(err);
        });

        socket.once('close', () => { socket.__closed = true; });

        if (port) {
          socket.bind(port, function () {
            accept(socket);
          });
        } else {
          accept(socket);
        }
      });
    } catch (e) {
      //console.log(e);
      return null;
    }
  },
  makeCommandWithAuth: function (data, token) {
    var command = this.concatenateBuffer(
      new Uint8Array([
        CONFIG.COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_OPERACAO_REMOTA,
      ]),
      new Buffer.from(token)
    );
    command = this.concatenateBuffer(command, new Uint8Array([0, 0, 0, 0]));
    return this.concatenateBuffer(command, data);
  },
  sleep: (milliseconds) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  },
};

module.exports = UdpUtils;
