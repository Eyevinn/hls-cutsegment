var m3u8        = require('m3u8');
var fs          = require('fs');

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


module.exports = {
    clipFile : clipFile,
    stitchBack : stitchBack
}
