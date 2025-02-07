/* eslint-disable no-param-reassign */
const path = require('path');
const utils = require('../../utils');
const { getMeteData } = require('../../Middleware/video');
const { CustomError, CODES } = require('../../error');

const videoResolutionList = [
  { height: 144, videoBandWidth: 190, audioBandWidth: 32, frameRate: 30 },
  { height: 360, videoBandWidth: 465, audioBandWidth: 32, frameRate: 30 },
  { height: 720, videoBandWidth: 2500, audioBandWidth: -1, frameRate: -1 },
  { height: 1080, videoBandWidth: 4500, audioBandWidth: -1, frameRate: -1 },
];

/**
 *
 * @param {import('fluent-ffmpeg').FfprobeData} metadata
 * @returns
 */
const audioVideoMapped = async (metadata) => {
  const { format, streams } = metadata;
  let result = '';
  let videoStreamMap = '';
  let audioStreamMap = '';
  let isVideoHeightAvailableInSizeList = false;
  const videoFormat = format.format_name;

  const { height, ...rest } = streams.find((v) => v.codec_type.toLowerCase() === 'video');

  // It will get bitrate of video from metadata
  let bitRate = Number.isInteger(rest.bit_rate) ? rest.bit_rate : format.bit_rate;

  // if bitrate not available in metadata data then it will set based on height of video from videoResolutionList
  bitRate = Number.isInteger(bitRate)
    ? bitRate
    : videoResolutionList.find((v, i) => videoResolutionList.length - 1 === i || videoResolutionList[i + 1].height >= 1900).videoBandWidth * 1024;

  // Video Scripting of map, Filter and bandwidth
  result += videoResolutionList.reduce((videoScript, resolution, idx) => {
    if (resolution.height > height) {
      resolution.height = height;
    }

    const isOkResolution = resolution.height < height || resolution.height === height;

    if (isOkResolution && !isVideoHeightAvailableInSizeList) {
      // Calculate bitrate based on resolution
      const bitRateRatio = resolution.height / height;
      const bitRateBasedOnHeight = ((bitRateRatio * bitRate) / 1024).toFixed(0);
      const idealBitRate = Math.min(bitRateBasedOnHeight, bitRate, resolution.videoBandWidth);

      // If video format is AVI then hwupload_cuda will include in -filter resolution
      const ifAVIFormat = videoFormat.toLowerCase() === 'avi' ? 'hwupload_cuda,' : '';

      videoScript = ` -map 0:v:0 ${videoScript}`;
      // videoScript += ` -filter:v:${idx} "${ifAVIFormat}scale_cuda=h=${resolution.height}:w=-1" -b:v:${idx} ${idealBitRate}k`;
      videoScript += ` -filter:v:${idx} "${ifAVIFormat}scale=h=${resolution.height}:w=-2" -b:v:${idx} ${idealBitRate}k`;
      videoStreamMap += ` v:${idx},agroup:audio,name:video/${resolution.height}p`;
    }

    if (resolution.height === height) {
      isVideoHeightAvailableInSizeList = true;
    }
    return videoScript;
  }, '');

  // Audio scripting of Multiple Language map, group
  result += metadata.streams
    .filter((v) => v.codec_type.toLowerCase() === 'audio')
    .reduce((audioScript, data, idx) => {
      audioScript += ` -map 0:a:${idx}`;

      // Audio group properties
      const audioName = `audio/${data.tags?.language || 'hin'}`;
      const audioLanguage = data.tags?.language || 'hin';
      const isAudioDefault = idx === 0 ? 'YES' : 'NO';

      audioStreamMap += ` a:${idx},agroup:audio,name:${audioName},language:${audioLanguage},default:${isAudioDefault}`;
      return audioScript;
    }, '');

  result += ` -var_stream_map "${audioStreamMap.trim()} ${videoStreamMap.trim()}"`;
  return result;
};

/**
 *
 * @param {string} sourceVideoPath
 * @param {string} [destination]
 * @returns
 */
const HLSVideo = async (sourceVideoPath, destination) => {
  // Resolve input video file path
  console.log('sourceVideoPath'+sourceVideoPath)
  const inputFilePath1 = /http:|https:/.test(sourceVideoPath) || path.isAbsolute(sourceVideoPath) ? sourceVideoPath : path.join(__dirname, sourceVideoPath);
console.log(inputFilePath1);
 // Project root directory
 const rootDir = path.resolve(__dirname, '..', '..');  // Move two levels up to reach project root

 // Resolve the input file path
 let inputFilePath = /http:|https:/.test(sourceVideoPath) || path.isAbsolute(sourceVideoPath)
   ? sourceVideoPath
   : path.join(rootDir, sourceVideoPath);  // Resolve relative to the project root

 console.log('Resolved inputFilePath: ' + inputFilePath);  // Debugging line to check the resolved path

 // Remove '/src' from the path if it's part of the resolved path
 if (inputFilePath.includes('/src/')) {
   inputFilePath = inputFilePath.replace('/src/', '/');  // This will remove the '/src/' from the path
 }

 console.log('Fixed inputFilePath (no /src/): ' + inputFilePath);
  const pathArray = destination || inputFilePath.split(/\/|\\/).slice(0, -1);
  const hlsVideoDestinationPath = typeof pathArray === 'string' ? pathArray : utils.joinPath(...pathArray);
  if (/http:|https:/.test(sourceVideoPath) && !destination) {
    throw new CustomError({ message: 'destination required with web url', code: CODES.HLS_SCRIPT_ERROR.code, name: 'HLS Script Generator' });
  }
  const videoMetadata = await getMeteData(inputFilePath);
  console.log('hlsVideoDestinationPath',hlsVideoDestinationPath)
  // HLS Script parameters
  // const preCudaScript = '-hwaccel nvdec -hwaccel_output_format cuda -extra_hw_frames 5';
  const preCudaScript = '-extra_hw_frames 5'; 
  const audioVideoCodecs = '-c:v libx264 -c:a aac';
  const audioVideoMapScript = await audioVideoMapped(videoMetadata);
  const hlsPostScript = '-threads 0 -f hls -hls_playlist_type event -hls_time 3';
  const segmentName = `-hls_segment_filename "${utils.joinPath(hlsVideoDestinationPath || '.', 'hls/%v/file-%00d.ts')}"`;
  const masterPlaylistName = '-master_pl_name master.m3u8';
  const outputManifestDirectory = utils.joinPath(hlsVideoDestinationPath || '.', 'hls/%v/manifest.m3u8');
  
  const script = `ffmpeg -loglevel error -stats ${preCudaScript} -i "${inputFilePath}" ${audioVideoCodecs} ${audioVideoMapScript} ${hlsPostScript} ${segmentName} ${masterPlaylistName} "${outputManifestDirectory}"`;
  return { script, destination: `${pathArray.slice(-1)}/hls/master.m3u8`, duration: videoMetadata.format?.duration };
};




module.exports = HLSVideo;
