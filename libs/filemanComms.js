'use strict';

var comms;
var Bluebird = require('bluebird');
var channelName = 'fileMan';
var requestCounter = 0;
var JSZip = require('jszip');
var path = require('path');
var fs = require('fs');

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
   if(!_isObject(opts) || !_isObject(opts.options) || !opts.options.hasOwnProperty('interfaceType')){
      return Bluebird.reject('No interface configured for this device: '+device);
   }

   return _request(channelName, 'list', {
      serialNumber: device,
      commandOptions: opts.options
   })
   .then(function(ret){
      if(ret.error){
         var str = "Error retrieving list of files: " + ret.error.message;
         return Bluebird.reject(new Error(str));
      }
      return ret;
   });
}

function destroy(device, files, opts){
   if(!_isObject(opts) || !_isObject(opts.options) || !opts.options.hasOwnProperty('interfaceType')){
      return Bluebird.reject('No interface configured for this device: '+device);
   }
   opts.options.filenames = files;

   return _request(channelName, 'destroy', {
      serialNumber: device,
      commandOptions: opts.options
   });
}

function create(device, file, opts){
   if(!_isObject(opts) || !_isObject(opts.options) || !opts.options.hasOwnProperty('interfaceType')){
      return Bluebird.reject('No interface configured for this device: '+device);
   }

   Object.keys(file).forEach(function(k){
      opts.options[k] = file[k];
   });

   return _request(channelName, 'create', {
      serialNumber: device,
      commandOptions: opts.options
   });
}

function read(device, filenames, opts){
   if(!_isObject(opts) || !_isObject(opts.options) || !opts.options.hasOwnProperty('interfaceType')){
      return Bluebird.reject('No interface configured for this device: '+device);
   }

   if(opts.zip){
      var zip = new JSZip();
      zip.file(device, '',{dir: true});
      filenames.forEach(function(filename){
         zip.file(path.join(device,filename), fs.createReadStream(path.join(opts.logFilesBasePath, device,filename)));
      });
      return zip.generateNodeStream({streamFiles:true});
   }

   return _request(channelName, 'read', {
      serialNumber: device,
      commandOptions: opts.options
   });
}

function _isObject(o){
   return typeof o === 'object' && o !== null && o !== undefined;
}

function _request(channel, cmd, data, noResponse){
   requestCounter++;
   return new Bluebird(function(resolve, reject){
      data.reqId = requestCounter;
      comms.send(channel, cmd, data);
      if(noResponse){
         resolve();
      }
      var timeoutId = setTimeout(function(){
         reject(new Error('Request timeout for command: '+cmd));
      }, 300000);
      comms.once(cmd+requestCounter, function(d){
         clearTimeout(timeoutId);
         resolve(d);
      });
   });
}
