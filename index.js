
const redisService = require('./libs/redisService.js');
const fsService = require('./libs/fileSystemService.js');
const edsParser = require('./libs/edsParser.js');
const fileManComms = require('./libs/filemanComms.js');

const xports = {   
   redisService: redisService, 
   fsService: fsService, 
   edsParser: edsParser, 
   fileManComms:fileManComms
};

module.exports = xports;

