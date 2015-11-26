
var http        = require( 'http'           );
var m3u8        = require( 'm3u8'           );
var fs          = require( 'fs'             );
var ffmpeg      = require( 'ffmpeg'         );
var express     = require( 'express'        );
var url         = require( 'url'            );
var qstring     = require( 'querystring'    );
var cutter      = require( './lib/clipFile' );
var ffprobe     = require( 'node-ffprobe'   );
var p           = require( 'path'           );
var glob        = require( 'glob'           );

var parser;
var file;
var publicDir = p.join(__dirname, "public");
var streamDir = p.join(publicDir, "streams");
var adDir = p.join(publicDir, "ads");

var app = express();

app.use(express.static(publicDir));

function manifestDuration(manifestfile,callback)
{
	parser = m3u8.createStream();
	file   = fs.createReadStream(manifestfile);

	file.pipe(parser);

	total = 0.0;

	parser.on('item', function(item) {
		total += item.get('duration') ;
	});
	parser.on('m3u', function(m3u) {
		callback(total);
	});

}


app.set('view engine', 'jade');

app.get('/', function (req, res)
{

	var path = url.parse(req.url).pathname ;
	var params = qstring.parse(url.parse(req.url).query);

	glob(streamDir + "/*/*m3u8", function(err, data) {
		data = data.map(function(f){ return { directory: p.basename(p.dirname(f)),
			file: p.basename(f,'.m3u8'),
			 orig: p.basename(p.dirname(f)) == p.basename(f,'.m3u8') ? true : false };});
		res.render('FileSelector', {"files": data});
	});

});

app.get('/cutpoint', function (req,res)
{

	var path = url.parse(req.url).pathname ;
	var params = qstring.parse(url.parse(req.url).query);

	var media = params.media;
	filename = p.join(streamDir, media, media + ".m3u8");

	manifestDuration(filename,function (total) {
		var ext = p.extname(filename);
		var directory = p.dirname(filename);
		var revisionFile = p.join(directory,"revision");
		var revision = 0;
		try {
			revision = Number(fs.readFileSync(revisionFile, "utf8"));
		} catch(err) {
			console.err("No revision file");
		}
		revision = revision + 1;
		fs.writeFileSync(revisionFile, revision);
		var newfile = p.join(p.basename(filename, ext) + "_" + revision + ext);
		res.render(
			'Parameters',
			{ orig_file : filename,
				new_file : newfile,
			duration : total } );
	} );
});


app.get('/docut', function (req,res)
{
	console.log(__dirname);

	var path = url.parse(req.url).pathname ;
	var params = qstring.parse(url.parse(req.url).query);

	var old_fn = params['oldfile'];
	var currentStreamDir = p.dirname(old_fn);
	var new_fn = p.join(currentStreamDir, params['newfile']);
	var revision = params.newfile.match(/.*_(\d+)\.m3u8$/)[1];
	var clpp = params['clippoint'];
	//var ad = params['ad'];
	var ad = "public/ads/BigBuckAd4.ts";
	var dur = params['dur'];

	cutter.clipFile( old_fn, clpp, function(ftc,wtc)
	{
		ftc = p.join(currentStreamDir,ftc);
		var cut1 = p.join(currentStreamDir, p.basename(ftc,p.extname(ftc)) + "_" + revision + "a" + p.extname(ftc));
		var cut2 = p.join(currentStreamDir, p.basename(ftc,p.extname(ftc)) + "_" + revision + "b" + p.extname(ftc));

		//var addur  = 10.0;

		ffprobe( ad, function(err, probeData) {
			var addur = probeData.format.duration;
			console.log(addur);
			cutter.stitchBack(old_fn,new_fn,clpp,ftc,cut1,cut2,ad,addur, cutter.cutMediaFile(res)); 
		});

		//cutter.stitchBack(old_fn,new_fn,clpp,ftc,cut1,cut2,ad,0, cutter.cutMediaFile(res)); 
            
	});
});


function list_param_page( connection, args, callback )
{
	callback(str);
}

var server = app.listen(8080, function ()
{
	console.log('ffmpeg test app listening at http://%s:%s', 'localhost', server.address().port);
});




