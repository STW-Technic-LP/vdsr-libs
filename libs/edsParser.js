var R = require('ramda');

module.exports = function(eds){
   var ret = parse(eds);
   ret = compile(ret);
   return ret;
};

function parse(eds) {
    'use strict';

    var readingValues = false;
    var inSub = false;
    var bracketedValue = '';
    var subValue = '';
    var type = '';
    var ignore = false;

    function sortIndex(v) {
        if (inRangeHex('1400', '1600', v)) {
            return 'coms';
        } else if (inRangeHex('1600', '1800', v)) {
            return 'maps';
        } else if (inRangeHex('1800', '1A00', v)) {
            return 'coms';
        } else if (inRangeHex('1A00', '1C00', v)) {
            return 'maps';
        } else if (inRangeHex('2000', '9FFF', v)) {
            return 'dictionary';
        } else {
            return '';
        }
    }

    return eds.split('\n').reduce(function (ret, line) {
        // ignore comments and empty lines
        if (line.indexOf(';') === 0 || line.length === 0) {
            return ret;
        }
        // definition of a new object or subobject
        if (line.indexOf('[') >= 0) {
            readingValues = true;
            subValue = '';

            // FIXME: there should be better validation checking of bracketed values...
            bracketedValue = line.substring(line.indexOf('[') + 1, line.lastIndexOf(']')).toUpperCase();
            if (bracketedValue.indexOf('SUB') > 0) {
                if (ignore) {
                    return ret;
                }
                subValue = bracketedValue.substring(bracketedValue.indexOf('SUB') + 3);
                subValue = subValue.length === 1 ? "0"+subValue : subValue;
                subValue = "0x" + subValue;
                bracketedValue = "0x" + bracketedValue.substring(0, bracketedValue.indexOf('SUB'));
                if(!ret[type][bracketedValue].subindices){
                   ret[type][bracketedValue].subindices = {};
                }
                ret[type][bracketedValue].subindices[subValue] = {};
                return ret;
            }
            ignore = false;
            type = sortIndex(bracketedValue);
            if (!type) {
                ignore = true;
                return ret;
            }
            bracketedValue = "0x"+bracketedValue;
            ret[type][bracketedValue] = {};
            return ret;
        }
        // in the middle of parsing an object
        if (readingValues && !ignore) {
            var pieces = line.split('=');
            if (subValue.length) {
                ret[type][bracketedValue].subindices[subValue][pieces.shift()] = pieces.join('');
                return ret;
            }
            ret[type][bracketedValue][pieces.shift()] = pieces.join('');
        }
        return ret;
    }, {
        coms: {},
        maps: {},
        dictionary: {}
    });
}

function compile(edsObj){
   var add200Hex = addHex("0x200");
   var ret = Object.keys(edsObj.coms).reduce(function(result, comKey){
      var mapObj = edsObj.maps[add200Hex(comKey)];
      var comObj = edsObj.coms[comKey];

      var currentVar = {};

      var toBinaryFromHex = changeBase(2, 16);
      var toHexFromBinary = changeBase(16, 2);

      var cobIdStr = comObj.subindices['0x01'].DefaultValue;
      var hexIdx = cobIdStr.indexOf('0x');
      cobIdStr = cobIdStr.substring(hexIdx + 2);
      var extid = false;
      if (cobIdStr.length > 4) {
         // decode first byte
         var firstByte = cobIdStr[0];
         var firstByteBin = "000"+toBinaryFromHex(firstByte);
         firstByteBin = firstByteBin.substr(firstByteBin.length-4);
         if (firstByteBin[0] === "1") {
            return;
         }
         extid = firstByteBin[2] === "1";
      }
      var cobIdBin = toBinaryFromHex(cobIdStr);
      var canidBin = extid ? cobIdBin.substr(-29) : cobIdBin.substr(-11);
      var canid = toHexFromBinary(canidBin);
      var addNodeId = hexIdx !== 0;

      // get mapped object for each subindex
      var startbit = 0;
      var mappedSubs = Object.keys(mapObj.subindices).map(function(mapSubidxKey){
         if(mapSubidxKey === '0x00'){
            return;
         }
         var mapSubidxObj = mapObj.subindices[mapSubidxKey];
         var defValue = mapSubidxObj.DefaultValue;
         var len = parseInt(defValue.substr(8), 16);
         var index = "0x"+defValue.substr(2,4).toUpperCase();
         var subindex = "0x"+defValue.substr(6,2).toUpperCase();
         if(edsObj.dictionary[index].subindices[subindex].PDOMapping === "0"){
            return;
         }
         var oldStartbit = startbit;
         startbit = len + startbit;
         return {
            index: index,
            subindex: subindex,
            length: len,
            startbit: oldStartbit,
            offset: 0,
            scaling: 1,
            canid: canid,
            addNodeId: addNodeId,
            type: mapDatatype(edsObj.dictionary[index].subindices[subindex].DataType),
            name: edsObj.dictionary[index].subindices[subindex].ParameterName,
            extid: extid
         };
      });

      return result.concat(mappedSubs);
   },[]);

   return ret.filter(function(i){
      return i !== undefined;
   });
}

function inRangeHex(low, high, v) {
    return parseInt(v, 16) >= parseInt(low, 16) && parseInt(v, 16) < parseInt(high, 16);
}

var changeBase = R.curry(function(endBase, startBase, v) {
   return parseInt(v, startBase).toString(endBase).toUpperCase();
});

var addHex = R.curry(function(a, b){
   //if(!(a instanceof String) || !(b instanceof String)){
   //   return new Error("Failed attempt to add non string hex values");
   //}
   return "0x"+(parseInt(a, 16) + parseInt(b, 16)).toString(16).toUpperCase();
});

function mapDatatype(v){
   var map = {
      '0x2': 's8',
      '0x3': 's16',
      '0x4': 's32',
      '0x5': 'u8',
      '0x6': 'u16',
      '0x7': 'u32'
   };
   return inRangeHex("0x2", "0x8", v) ? map[v] : 'unsupported';
}
