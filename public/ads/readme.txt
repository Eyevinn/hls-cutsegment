Ad file here
An ad .ts file needs to have 
  1) No timestamp stream
  2) A start time of 0 for the video stream

An ad .ts file can be created with
  ffmpeg -i <inputfile> -c:video h264 -profile:v baseline -strict -2 -c:audio aac -mpegts_copyts 1 myAd.ts

TODO: 
  enable ad HLS manifest. Currently we only accept a single .ts file
