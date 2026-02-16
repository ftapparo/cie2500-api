const config = require("../../../routes/config")();

function createAuthFrame(password) {
  const frame = Buffer.alloc(128).fill(0);
  frame[0] = config.CIE_commands.SET_GATEWAY_AUTH_ETH;
  frame.set(Buffer.from(password), 1);
  return frame;
}

module.exports = {
  createAuthFrame,
};
