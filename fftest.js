
var http        = require( 'http'        );
var m3u8        = require( 'm3u8'        );
var fs          = require( 'fs'          );
var ffmpeg      = require( 'ffmpeg'      );
var express     = require( 'express'     );
var url         = require( 'url'         );
var qstring     = require( 'querystring' );

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

function ClipFile(
	manifestfile,
	clippoint,
	callback
)
{
	parser = m3u8.createStream();
	file   = fs.createReadStream(manifestfile);

	file.pipe(parser);

	total = 0.0;
	file_to_clip = '';
	where_to_clip = 0.0;
	found = false;

	parser.on('item', function(item) {
		oldtotal = total;
		total += item.get('duration') ;
		if( (total >= clippoint) && !found )
		{
			file_to_clip = item.get('uri');
			where_to_clip = clippoint - oldtotal;
			found = true;
		}
	});
	parser.on('m3u', function(m3u) {
		if(found)
			callback( file_to_clip, where_to_clip );
		else
			callback( 'error', -1 );
	});
}

function StitchBack(
	old_manifest,
	new_manifest,
	clippoint,
	splitfile_1,
	splitfile_2,
	inserted_file,
	inserted_duration,
	callback
)
{

	parser_i = m3u8.createStream();
	file_i   = fs.createReadStream(old_manifest);
	file_i.pipe(parser_i);

	parser_o = m3u8.M3U.create();

	total = 0.0;
	found = false;

	parser_i.on('item', function(item) {
		oldtotal = total;
		dur = item.get('duration');
		total += dur;
		if( (total >= clippoint) && ! found )
		{
			found = true;
			clpp = clippoint - oldtotal;
			parser_o.addPlaylistItem({
				duration : clpp,
				uri      : splitfile_1
			});
			parser_o.addPlaylistItem({
				duration : inserted_duration,
				uri      : inserted_file
			});
			parser_o.addPlaylistItem({
				duration : dur-clpp,
				uri      : splitfile_2
			});
		} else {
			fn = item.get('uri');
			parser_o.addPlaylistItem({
				duration : item.get('duration'),
				uri      : fn
			});
		}

	});
	parser_i.on('m3u', function(m3u)
	{
		str = parser_o.toString();
		fs.writeFile(new_manifest, str, function(err) {
			if(err) {
				console.log(err);
				callback(false,"");
			} else {
				console.log("wrote new manifest ok");
				console.log("---------------------");
				callback(true,str);
			}
		});
	} );
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

	ClipFile( old_fn, clpp, function(ftc,wtc)
	{
		cut_file_name(ftc, function( pth, fn, ext )
		{
			var cut1 = pth + fn + "_1" + ext;
			var cut2 = pth + fn + "_2" + ext;
			console.log("---------------------");
			console.log(cut1);
			console.log(cut2);
			console.log("---------------------");
			StitchBack(old_fn,new_fn,clpp,cut1,cut2,ad,0,function(ok,str)
			{
				var ff_fn = __dirname + "\\" + fn + ext;
				console.log("---------------------");
				console.log(ff_fn);
				console.log("---------------------");
				var ff = new ffmpeg(ff_fn);
				ff.then(function (video) {
					video
					// ffmpeg -i video.mp4 -ss 00:01:00 -to 00:02:00 -c copy cut.mp4
					.addCommand('-ss', '0', '-to', clpp, '-c', 'copy' )
					.save(cut1, function (error, file) {
						if (!error)
						{
							ff.then(function (video) {
								video
								.addCommand('-ss', clpp, '-to', dur, '-c', 'copy' )
								.save(cut2, function (error, file) {
									if (!error)
									{
										res.send( head() + "it all woked" + tail() );
									} else { res.send( head() + "part 2 error" + tail() ); }
								});
							});
						} else { res.send( head() + "part 1 error" + tail() ); }
					});
				});
			});
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




