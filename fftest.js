
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

var parser;
var file;
var publicDir = p.join(__dirname, "public");
var streamDir = p.join(publicDir, "streams");
var adDir = p.join(publicDir, "ads");

var app = express();

app.use(express.static(publicDir));

function head()
{
	return '<html><head><meta charset=\'utf-8\'><title>ffmpeg Tester</title></head><body>' ;
}

function tail()
{
	return '</body></html>' ;
}

function ManifestDuration(manifestfile,callback)
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

	fs.readdir(streamDir, function(err, data){
		res.render('FileSelector', {"files": data});
	});

});

function cut_file_name( filename, callback )
{
	var path = p.dirname(filename);
	var ext = p.extname(filename);
	var fn = p.basename(filename, ext);
	callback( path, fn, ext );
}

app.get('/cutpoint', function (req,res)
{

	var path = url.parse(req.url).pathname ;
	var params = qstring.parse(url.parse(req.url).query);

	var media = params.media;
	var filename = fs.readdirSync(p.join(streamDir,media)).filter(function(f) {return f && f.match(/.*m3u8$/);})[0] ;
	filename = p.join(streamDir, media, filename);


	ManifestDuration(filename,function (total) {

		cut_file_name( filename, function( pth, fn, ext ) {

			var newfile = p.join(pth,fn + "_new" + ext);

			res.render(
				'Parameters',
				{ ogig_file : filename,
				  new_file : newfile,
				  duration : total } );

		} );

	} );

});


app.get('/docut', function (req,res)
{
	console.log(__dirname);

	var path = url.parse(req.url).pathname ;
	var params = qstring.parse(url.parse(req.url).query);

	var old_fn = params['oldfile'];
	var currentStreamDir = p.dirname(old_fn);
	var new_fn = params['newfile'];
	var clpp = params['clippoint'];
	//var ad = params['ad'];
	var ad = "public/ads/ad.ts";
	var dur = params['dur'];

	cutter.clipFile( old_fn, clpp, function(ftc,wtc)
	{
		ftc = p.join(currentStreamDir,ftc);
		var cut1 = p.join(currentStreamDir, p.basename(ftc,p.extname(ftc)) + "_1" + p.extname(ftc));
		var cut2 = p.join(currentStreamDir, p.basename(ftc,p.extname(ftc)) + "_2" + p.extname(ftc));

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

app.get('*', function (req, res)
{
	var path = url.parse(req.url).pathname ;
	var params = qstring.parse(url.parse(req.url).query);

	var str = "";
	str += '<h1> List Params for "';
	str += path + '" </h1>' ;
	str += '<hr>' ;
	str += '<table border=1 cellpadding=4>';
	str += '<tr><th>Param</th><th>Value</th></tr>';
	for( var key in params  )
	{
		str += '<tr><td>';
		str += key;
		str += '</td><td>';
		str += params[key];
		str += '</td></tr>';
	}
	str += "</table>";

	res.send( head() + str + tail() );

});

var server = app.listen(8080, function ()
{
	console.log('ffmpeg test app listening at http://%s:%s', 'localhost', server.address().port);
});




