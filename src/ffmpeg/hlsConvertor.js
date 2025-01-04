const { exec } = require('child_process');
const { infoLog } = require('../logger');
const { checkParameters } = require('../utils');
const { CustomError, CODES } = require('../error');
const ffmpegScript = require('../Script/ScriptGenerator');
const models = require('../Database/models');


const videoConversionProgress = (data, duration) => {
  const output = data.toString('utf8');
  const progressMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
  if (progressMatch) {
    const currentTime = progressMatch[1];
    const timeArray = currentTime.split(':');
    const [seconds, ms] = timeArray[2].split('.');
    const inSecond = Number(seconds) + Number(timeArray[1] * 60) + Number(timeArray[0] * 60 * 60);
    const percent = parseFloat(`${inSecond}.${ms}`) / duration;
    process.stdout.write(`\r[${'#'.repeat((100 * percent).toFixed(0))}${'.'.repeat((100 - 100 * percent).toFixed(0))}] ${(percent * 100).toFixed(2)}% `);
  }
};

const videoConversionPercent = async (data, duration,videoId) =>  {
  console.log('video id conversion', videoId);
  const output = data.toString('utf8');
  const progressMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
  if (progressMatch) {
    const currentTime = progressMatch[1];
    const timeArray = currentTime.split(':');
    const [seconds, ms] = timeArray[2].split('.');
    const inSecond = Number(seconds) + Number(timeArray[1] * 60) + Number(timeArray[0] * 60 * 60);
    const percent = parseFloat(`${inSecond}.${ms}`) / duration;
    await models.video.insertVideoProgress(percent,videoId);
  }
};


const hls = {
  /**
   *
   * @param {string} videoSourcePath
   * @returns {Promise<{hlsUrl: string, message: string}>}
   */

  async convertor(videoSourcePath,videoDuration, metadata, videoId) {
    infoLog('Start', 'HLS-Video-Converter');
    console.log('hlsconvertervideoSourcePath', videoSourcePath ,'hls.convertor', videoId);
    
    const command = await ffmpegScript.HLSVideo(videoSourcePath);
    
    return new Promise((resolve, reject) => {
      console.log('Executing command:', command.script);
      const exc = exec(command.script, (err, stdout, stderr) => {
        if (err) {
          console.error('Exec error:', err);
          reject(new CustomError({ message: err.message, name: err.name, ...err, code: CODES.HLS_ERROR.code }));
        }
        if (stderr) {
          console.error('stderr:', stderr);
        }
        if (stdout) {
          console.log('stdout:', stdout);
        }
      });
  
      exc.stderr.on('data', (data) => {
        console.log('stderr data:', data.toString());
        videoConversionProgress(data, command.duration);
        videoConversionPercent(data, command.duration, videoId);
      });
  
      exc.on('close', (code) => {
        console.log('ffmpeg process closed with code', code);
        if (code !== 0) {
          reject(new CustomError(`Something went wrong in Video Conversion: closed with code - ${code}`, 'hls-close', CODES.HLS_ERROR.code));
        } else {
          console.log('Video conversion completed successfully');
          resolve({ hlsUrl: command.destination, message: CODES.HLS_SUCCESS.message });
        }
      });
    });
  }

  
};

module.exports = hls;
