var m3u8   = require('m3u8'),
    fs     = require('fs'),
    ffmpeg = require('ffmpeg');

function clipFile(
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

function stitchBack(
	old_manifest,
	new_manifest,
	clippoint,
    mediaFile,
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
				callback(err);
			} else {
				console.log("wrote new manifest ok");
				console.log("---------------------");
				callback(null, mediaFile, clpp, splitfile_1, splitfile_2);
			}
		});
	} );
}

function cutMediaFile(res) {
	function callback(err) {
		if (err) {
			res.send(err);
		} else {
			res.redirect("/");
		}
	}
	return function (err, fileToCut, whereToCut, cut1, cut2) {
		if (err) {
			return callback(err);
		}
		console.log(fileToCut, whereToCut, cut1, cut2);
		console.log("----------------------------------------");
		var ff = new ffmpeg(fileToCut);
		ff.then(function (video) {
			video.addCommand('-ss', '0:0:0' );
			video.addCommand('-to', '0:0:' + whereToCut );
			video.addCommand('-c', 'copy' );
			video.save(cut1, function (error, file) {
				if (error) {
					return callback(error);
				}
				var ff2 = new ffmpeg(fileToCut);
				ff2.then(function (video2) {
					video2.addCommand('-ss', whereToCut );
					video2.addCommand('-c', 'copy' );
					video2.save(cut2, callback );
				});
			});
		});
	};
}

module.exports = {
    clipFile : clipFile,
    stitchBack : stitchBack,
    cutMediaFile : cutMediaFile
}
