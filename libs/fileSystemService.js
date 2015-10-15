'use strict';

var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');

module.exports = {
  stat: stat,
  oldest: oldest,
  size: size,
  prune: prune,
  writeFile: writeFile,
  readFile: readFile,
  deleteFile: deleteFile,
  list: list
};

// :: (String) -> Promise(Error, Stats)
function lstatAsync(filepath){
  return new Promise(function(resolve, reject){
    fs.lstat(filepath, function(err, stats){
      if(stats){
        stats._filepath = filepath;
        return resolve(stats);
      }
      reject(err);
    });
  });
}

// :: (String, String) -> Promise(Error, ())
function writeFileAsync(filePath, data) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(filePath, data, function(err) {
      return err ? reject(err) : resolve();
    });
  });
}

// :: (String) -> Promise(Error, String)
function readFileAsync(filePath, opts){
  return new Promise(function(resolve, reject){
    fs.readFile(filePath, opts, function(err, f){
      return err ? reject(err) : resolve(f);
    });
  });
}

// :: (String) -> Promise(Error, ())
function mkdirAsync(filePath) {
  return new Promise(function(resolve, reject) {
    fs.mkdir(filePath, function(err) {
      return err ? reject(err) : resolve();
    });
  });
}

// :: (String) -> Promise(Error, ())
function rmdirAsync(filePath) {
  return new Promise(function(resolve, reject) {
    console.log('test');
    fs.rmdir(filePath, function(err) {
      return err ? reject(err) : resolve();
    });
  });
}

// :: (String) -> Promise(Error, ())
function unlinkAsync(filePath){
  return new Promise(function(resolve, reject){
    fs.unlink(filePath, function(err){
      return err ? reject(err) : resolve();
    });
  });
}

// :: (String) -> Promise(Error, [String])
function readdirAsync(filepath){
  return new Promise(function(resolve, reject){
    fs.readdir(filepath, function(err, files){
      return err ? reject(err) : resolve(files);
    });
  });
}

// :: ((Stats -> Boolean), (Stats -> Promise(Error, 'b)), (Stats -> Promise(Error, 'b))) -> Error -> Promise(Error, 'b)
function either(filter, handler1, handler2){
  return function() {
    return filter.apply(null, arguments) ?
           handler1.apply(null, arguments) :
           handler2.apply(null, arguments);
  };
}

// :: ((Error -> Boolean), (Error -> Promise(Error, 'b))) -> Error -> Promise(Error, 'b)
function only(filter, handler) {
  return function(err) {
    return filter(err) ? handler(err) : Promise.reject(err);
  };
}

// :: (String) -> Promise(Error, [String])
function list(filePath){
  return readdirAsync(filePath);
}

// :: (Error) -> Boolean
function isENOENT(error) {
  return error.code === 'ENOENT';
}

// :: (Stats) -> Boolean
function isDir(stats){
  return stats.isDirectory();
}

// :: a -> a
function identity(thing){
  return thing;
}

// :: (b, (a, b -> c)) -> (a => c)
function swapArgs(a2, fn){
  return function(a1){
    return fn(a2, a1);
  };
}

// :: String -> Promise([Stats])
function statDir(recurse){
  return function(stats){
    if(recurse){
      return list(stats._filepath)
         .map(swapArgs(stats._filepath, path.join))
         .map(stat);
    }
    return list(stats._filepath)
         .map(swapArgs(stats._filepath, path.join))
         .map(lstatAsync);
  };
}

// decide to flatten or not (this is for the pruning process)
// :: String -> Promise([Stats])
function stat(filepath, makeFlat, recurse){
  return lstatAsync(filepath)
  .then(either(isDir, statDir(recurse), identity))
  .then(either(function(){ return makeFlat;}, flatten, identity));
}

// :: (Stat, Stat) -> Boolean
function isOlder(a, b){
  return Date.parse(a.birthtime) > Date.parse(b.birthtime);
}

function latter(a, b){
  return b;
}

function oldest(filepath){
  return stat(filepath)
  .reduce(either(isOlder, identity, latter))
  .then(function(stat){
    return stat._filepath;
  });
}

function flatten(a) {
  if(!Array.isArray(a)){return a;}
  return a.reduce(function (res, cur) {
    if (!Array.isArray(cur)) {
      res.push(cur);
        return res;
    }
    res = res.concat(flatten(cur));
    return res;
  }, []);
}

function fileSize(stats){
  return stats.size;
}

function plus(a, b) {
  return a + b;
}

function sum(xs) {
  return xs.reduce(plus, 0);
}

function size(filepath){
  return stat(filepath)
  .then(flatten)
  .map(fileSize)
  .then(sum);
}

// :: [Stats] -> Promise([Stats])
function chronoSort(list){
  return Promise.resolve(list.sort(function(a,b){
    var atime = Date.parse(a.birthtime);
    var btime = Date.parse(b.birthtime);
    return atime === btime ? 0 : atime > btime ? 1 : -1;
  }));
}

// :: (String) -> Promise(Error, ())
function deleteFile(filePath){
  return unlinkAsync(filePath)
  .then(function(){ return filePath; });
}

function findOvergrowth(size, maxSize){
  return function(arr){
    return arr.reduce(function (res, itm) {
      if (size <= maxSize) {
        return res;
      }
      size -= itm.size;
      res.push(itm);
      return res;
    }, []);
  };
}

function val(prop){
  return function(itm){
    return itm[prop];
  };
}

function prune(filepath, maxSize){
  return size(filepath)
  .then(function(size){
    if(size < maxSize){
      return;
    }
    return stat(filepath)
    .then(chronoSort)
    .then(flatten)
    .then(findOvergrowth(size, maxSize))
    .map(val('_filepath'))
    .map(deleteFile);
  });
}


// :: (String, String) -> Promise(Error, ())
function writeFile(filepath, data) {
  return writeFileAsync(filepath, data)
  .catch(only(isENOENT, function() {
    return mkdirAsync(path.dirname(filepath))
    .then(writeFileAsync.bind(null,filepath, data))
    .catch(function(){
      return rmdirAsync(filepath);
    });
  }));
}

// :: (String) -> Promise(Error, String)
function readFile(filePath, opts){
  return readFileAsync(filePath, opts);
}
