const { join } = require('path');
const exec = require('./exec');

module.exports = (...paths) => exec('rm', ['-rf', ...paths]);
