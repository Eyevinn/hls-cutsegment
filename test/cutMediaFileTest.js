var cutter = require('../lib/clipFile.js');

var mediaFile = __dirname + "/../m00.ts";
var cut1 = "m00_cut1.ts";
var cut2 = "m00_cut2.ts";
var whereToCut = 1;
function callback(err) {
    console.log(err);
    console.log("Done!");
}
cutter.cutMediaFile(mediaFile, whereToCut, cut1, cut2, callback);
