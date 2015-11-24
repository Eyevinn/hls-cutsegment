
var http        = require( 'http'           );
var m3u8        = require( 'm3u8'           );
var fs          = require( 'fs'             );
var ffmpeg      = require( 'ffmpeg'         );
var express     = require( 'express'        );
var url         = require( 'url'            );
var qstring     = require( 'querystring'    );
var cutter      = require( './lib/clipFile' );
var ffprobe     = require( 'node-ffprobe'   );

var parser;
var file;

var app = express();

app.use(express.static('public'));

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

	res.render('FileSelector', { path:path, params:params });

});

function cut_file_name( filename, callback )
{
	var i1 = filename.lastIndexOf("/");
	var i2 = filename.lastIndexOf("\\");
	var i4 = Math.max(i1,i2);
	var path,rest;
	if(i4<0) {
		path = "";
		rest = filename;
	} else {
		path = filename.substr(0,i4);
		rest = filename.substr(i4);
	}
	var i3 = rest.lastIndexOf(".");
	var fn, ext;
	if(i3<0)
	{
		fn = rest;
		ext = "";
	} else {
		fn = filename.substr(0,i3);
		ext = filename.substr(i3);
	}
	callback( path, fn, ext );
}

app.get('/cutpoint', function (req,res)
{

	var path = url.parse(req.url).pathname ;
	var params = qstring.parse(url.parse(req.url).query);

	var filename = params['file'];

	ManifestDuration(filename,function (total) {

		cut_file_name( filename, function( pth, fn, ext ) {

			var newfile = pth + fn + "_new" + ext;

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
	var new_fn = params['newfile'];
	var clpp = params['clippoint'];
	var ad = params['ad'];
	var dur = params['dur'];

	cutter.clipFile( old_fn, clpp, function(ftc,wtc)
	{
		cut_file_name(ftc, function( pth, fn, ext )
		{
			var cut1 = pth + fn + "_1" + ext;
			var cut2 = pth + fn + "_2" + ext;
			
			//var addur  = 10.0;

			ffprobe( ad, function(err, probeData) {
				var addur = probeData.format.duration;
				console.log(addur);
				cutter.stitchBack(old_fn,new_fn,clpp,ftc,cut1,cut2,ad,addur, cutter.cutMediaFile(res)); 
			});

			//cutter.stitchBack(old_fn,new_fn,clpp,ftc,cut1,cut2,ad,0, cutter.cutMediaFile(res)); 
            
		});
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




