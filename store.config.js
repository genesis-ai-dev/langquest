// Use the data from `eas metadata:pull`
const config = require('./store.config.json');

const year = new Date().getFullYear();
config.apple.copyright = `${year} Frontier R&D`;

module.exports = config;
