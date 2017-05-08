'use strict';

var comms;

var channelName = 'fileMan';

module.exports = function(opts){

   comms = opts.messenger;

   return {
      list: list,
      destroy: destroy,
      create: create,
      read: read
   };
};

function list(device, opts){
   if(!_isObject(opts)){
      opts = {};
   }
   opts.device = device;
   comms.send(channelName, 'list', opts);
}

function destroy(files, opts){
   if(!_isObject(opts)){
      opts = {};
   }
   opts.files = files;
   comms.send(channelName, 'destroy', opts);
}

function create(files, opts){
   if(!_isObject(opts)){
      opts = {};
   }
   opts.files = files;
   comms.send(channelName, 'create', opts);
}

function read(device, files, opts){
   if(!_isObject(opts)){
      opts = {};
   }
   opts.files = files;
   opts.device = device;
   comms.send(channelName, 'read', opts);
}

function _isObject(o){
   return typeof o === 'object' && o !== null && o !== undefined;
}
