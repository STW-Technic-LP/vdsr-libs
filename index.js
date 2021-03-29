
const redisService = require('./libs/redisService.js');
const fsService = require('./libs/fileSystemService.js');
const edsParser = require('./libs/edsParser.js');
const fileManComms = require('./libs/filemanComms.js');

module.exports = {   
   redisService: redisService, 
   fsService: fsService, 
   edsParser: edsParser, 
   fileManComms:fileManComms
};
