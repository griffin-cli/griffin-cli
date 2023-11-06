const { join } = require('path');
const { mkdir } = require('fs/promises');

module.exports = async (...paths) => mkdir(join(...paths), { recursive: true });
