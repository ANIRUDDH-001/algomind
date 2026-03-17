const fs = require('fs');
const file = 'public/vad/vad-bundle.min.js';
let content = fs.readFileSync(file, 'utf8');
const oldStr = '!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t(require("onnxruntime-web")):"function"==typeof define&&define.amd?define(["onnxruntime-web"],t):"object"==typeof exports?exports.vad=t(require("onnxruntime-web")):e.vad=t(e.ort)}(self,';
const newStr = '!function(e,t){e.vad=t(e.ort)}(self,';
if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(file, content);
  console.log('Fixed vad-bundle.min.js');
} else {
  console.log('Old string not found');
}