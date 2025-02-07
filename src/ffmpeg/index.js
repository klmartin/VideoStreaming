/* eslint-disable valid-typeof */
const { statSync } = require('fs');
const { randomUUID } = require('crypto');
const hls = require('./hlsConvertor');
const { infoLog } = require('../logger');
const { joinPath, checkParameters } = require('../utils');
const models = require('../Database/models');
const videoQueueItem = require('../queue');
const { getMeteData } = require('../Middleware/video');
const { createThumbnail } = require('./thumbnailGenerator');
const { CODES } = require('../error');

let isMachineBusy = false;
let videoProcessStatusCode = 100;

// Methods which is part of Video conversion and updating database synchronized
const operation = {
  /**
   *
   * @param {number} max
   * @param {number} [min]
   * @returns
   */
  isPendingOperation(max, min) {
    if (typeof max !== 'number' && typeof min !== 'number') {
      return false;
    }
    if (typeof max === 'number' && typeof min === 'number') {
      return max > videoProcessStatusCode && videoProcessStatusCode >= min;
    }
    if (typeof max !== 'number') {
      return min <= videoProcessStatusCode;
    }
    return max > videoProcessStatusCode;
  },

  /**
   * @param {string | number} videoId
   * @param {string | number} userId
   * @param {import('fluent-ffmpeg').FfprobeStream} metaData
   * @param {number} fileSize
   * @param {string | number} frameRate
   * @param {number} videoDuration
   */
  async metaInfoAndVideo(videoId, userId, metaData, fileSize, frameRate, videoDuration, originalVideoPath,price,body,pinned,type) {
    infoLog('start', 'ffmpeg-operation-metaInfoAndVideo');
    console.log('video id ' +videoId);
    if (this.isPendingOperation(CODES.VIDEO_TABLE_SUCCESS.code)) {
      await models.video.insertVideo(videoId, userId, originalVideoPath,price,body,pinned,type,videoId);
      videoProcessStatusCode = CODES.VIDEO_TABLE_SUCCESS.code;
    } else {
      infoLog('Already Done', 'Video-Table-Insert');
    }


    if (this.isPendingOperation(CODES.VIDEO_META_TABLE_SUCCESS.code)) {
      await models.metaData.insertVideoMetaData({
        videoId,
        codec_name: metaData.codec_name,
        profile: metaData.profile,
        codec_tag_string: metaData.codec_tag_string,
        codec_tag: metaData.codec_tag,
        width: metaData.width,
        height: metaData.height,
        level: metaData.level,
        time_base: metaData.time_base,
        duration_ts: metaData.duration_ts,
        bit_rate: metaData.bit_rate,
        nb_frames: metaData.nb_frames,
        byte_size: fileSize,
        frameRate,
        duration: videoDuration,
      });
      videoProcessStatusCode = CODES.VIDEO_META_TABLE_SUCCESS.code;
    } else {
      infoLog('Already Done', 'Video_metadata-Table-Insert');
    }
  },

  /**
   *
   * @param {string} videoId
   * @param {string} videoDirectoryPath
   * @param {number} height
   * @param {number} aspectRatio
   * @param {object} config
   * @param {string} [config.folder]
   * @param {string} [config.filename]
   * @param {Array<number>} [config.size]
   * @param {number} [config.time]
   * @returns
   */

  // async thumbnail(videoId, videoDirectoryPath, height, aspectRatio, config) {
  //   infoLog('Start', 'ffmpeg-operation-thumbnail');

  //   const paramType = {
  //     videoId: ['string', 'number'],
  //     videoDirectoryPath: 'string',
  //     height: 'number',
  //     aspectRatio: 'number',
  //   };
  //   checkParameters(paramType, { videoDirectoryPath, videoId, height, aspectRatio });

  //   if (this.isPendingOperation(CODES.THUMBNAIL_GENERATE_SUCCESS.code)) {
  //     const imageList = await createThumbnail(videoDirectoryPath, { ...config });
  //     console.log('imageList',imageList);
  //     await videoQueueItem.update(videoId, { imageList });
  //     videoProcessStatusCode = CODES.THUMBNAIL_GENERATE_SUCCESS.code;
  //   } else {
  //     infoLog('Already Done', 'FFMPEG-Thumbnail-Generator');
  //   }

  //   if (this.isPendingOperation(CODES.THUMBNAIL_TABLE_SUCCESS.code, CODES.THUMBNAIL_GENERATE_SUCCESS.code)) {
  //     infoLog('Inserting start', 'thumbnail-item-insert');
  //     let { imageList } = await videoQueueItem.getVideoItem(videoId);
  //     infoLog(imageList);
  //     if (!imageList || imageList?.length <= 0) {
  //       imageList = await createThumbnail(videoDirectoryPath, { ...config });
  //     }
  //     const startInserting = async () => {
  //       const imageObject = imageList.shift();
  //       const pictureHeight = imageObject.size === -1 ? height : imageObject.size;
  //       const fileSize = statSync(imageObject.output).size;
  //       await models.thumbnail.insert(randomUUID(), videoId, imageObject.url, fileSize, pictureHeight, aspectRatio * pictureHeight);
  //       return imageList.length > 0 ? startInserting() : null;
  //     };
  //     await startInserting();
  //     videoProcessStatusCode = CODES.THUMBNAIL_TABLE_SUCCESS.code;
  //   } else {
  //     infoLog('Already Done', 'Thumbnail-Table-Insert');
  //   }
  //   return null;
  // },

  async thumbnail(videoId, videoDirectoryPath, height, aspectRatio, config) {
    infoLog('Start', 'ffmpeg-operation-thumbnail');
  
    const paramType = {
      videoId: ['string', 'number'],
      videoDirectoryPath: 'string',
      height: 'number',
      aspectRatio: 'number',
    };
    checkParameters(paramType, { videoDirectoryPath, videoId, height, aspectRatio });
  
    let imageList = [];
  
    if (this.isPendingOperation(CODES.THUMBNAIL_GENERATE_SUCCESS.code)) {
      imageList = await createThumbnail(videoDirectoryPath, { ...config });
      await videoQueueItem.update(videoId, { imageList });
      videoProcessStatusCode = CODES.THUMBNAIL_GENERATE_SUCCESS.code;
    } else {
      infoLog('Already Done', 'FFMPEG-Thumbnail-Generator');
    }
  
    if (this.isPendingOperation(CODES.THUMBNAIL_TABLE_SUCCESS.code, CODES.THUMBNAIL_GENERATE_SUCCESS.code)) {
      infoLog('Inserting start', 'thumbnail-item-insert');
      let { imageListFromDB } = await videoQueueItem.getVideoItem(videoId);
      infoLog(imageListFromDB);
  
      if (!imageListFromDB || imageListFromDB?.length <= 0) {
        imageListFromDB = await createThumbnail(videoDirectoryPath, { ...config });
      }
  
      const startInserting = async () => {
        const imageObject = imageListFromDB.shift();
        const pictureHeight = imageObject.size === -1 ? height : imageObject.size;
        const fileSize = statSync(imageObject.output).size;
        await models.thumbnail.insert(randomUUID(), videoId, imageObject.url, fileSize, pictureHeight, aspectRatio * pictureHeight);
        return imageListFromDB.length > 0 ? startInserting() : null;
      };
      await startInserting();
      videoProcessStatusCode = CODES.THUMBNAIL_TABLE_SUCCESS.code;
    } else {
      infoLog('Already Done', 'Thumbnail-Table-Insert');
    }
  
    // Return the list of thumbnails (imageList)
    return imageList;
  },
  

  /**
   *
   * @param {string | number} videoId
   * @param {string} videoSourceAbsolutePath
   * @param {number} videoDuration
   */
  async hlsAndHlsTable(videoId, videoSourceAbsolutePath, videoDuration, metadata) {
    console.log('videoSourceAbsolutePath'+videoSourceAbsolutePath);
    console.log(this.isPendingOperation(CODES.HLS_SUCCESS.code));
    console.log(CODES.HLS_SUCCESS.code)
     if (this.isPendingOperation(CODES.HLS_SUCCESS.code)) {
      console.log('videoSourceAbsolutePath1'+videoSourceAbsolutePath);
      const { hlsUrl } = await hls.convertor(videoSourceAbsolutePath, videoDuration, metadata,videoId);
      console.log('videoSourceAbsolutePath2'+videoSourceAbsolutePath);

      await videoQueueItem.update(videoId, { hlsUrl });
      console.log('videoSourceAbsolutePath3'+videoSourceAbsolutePath);

      videoProcessStatusCode = CODES.HLS_SUCCESS.code;
     } else {
       infoLog('Already Done', 'HLS-Video-Converter');
     }

    if (this.isPendingOperation(CODES.HLS_TABLE_SUCCESS.code, CODES.HLS_SUCCESS.code)) {
      console.log('videoSourceAbsolutePath4'+videoSourceAbsolutePath);

      const { hlsUrl } = await videoQueueItem.getVideoItem(videoId);
      console.log('hlsUrl'+hlsUrl);

      await models.hlsVideo.hlsInsert(videoId, hlsUrl);
      console.log('videoSourceAbsolutePath6'+videoSourceAbsolutePath);
      videoProcessStatusCode = CODES.HLS_TABLE_SUCCESS.code;
    } else {
      infoLog('Already Done', 'HLS-Video-Table_Insert');
    }
  },
};

const videoConversion = {
  async init() {
    infoLog('initialized', 'video-conversion');
    infoLog(isMachineBusy ? 'Running' : 'Ready', 'HLS-Machine Status');
    if (isMachineBusy) {
      infoLog('Machine is busy now, Please wait.');
      return;
    }

    isMachineBusy = true;
    const queueItem = await videoQueueItem.getVideoItem();
    if (typeof queueItem === 'object') {
      
      const { id, videoDirectoryPath, user_id, filename, statusCode,price,body,pinned,type,aspect_ratio } = queueItem;
      try {
        const videoSourceAbsolutePath = joinPath(videoDirectoryPath, filename);
        videoProcessStatusCode = statusCode;
        const { streams, format } = await getMeteData(videoSourceAbsolutePath);
        const stream = streams.find((v) => v.codec_type === 'video');
        const { height, width, r_frame_rate: frameRate, duration, rotation } = stream || streams[0];
        if (rotation) {
          await videoQueueItem.update(id, { rotation });
        }
        const videoDuration = typeof duration !== 'number' ? format.duration : duration;
        await operation.metaInfoAndVideo(id, user_id, stream || streams[0], format.size, frameRate, videoDuration, videoSourceAbsolutePath,price,body,pinned,type);
        const thumbnail = await operation.thumbnail(id, videoSourceAbsolutePath, height, height / width, { size: [256] });
        await operation.hlsAndHlsTable(id, videoSourceAbsolutePath, videoDuration, stream || streams[0]);
        videoQueueItem.updateStatusCode(id, videoProcessStatusCode, true);
        const { hlsUrl } = await videoQueueItem.getVideoItem(id);
        await videoQueueItem.sendVideoToServer(videoSourceAbsolutePath,price,body,pinned,user_id,aspect_ratio,thumbnail[0].output,hlsUrl);

        isMachineBusy = false;
        videoConversion.init();
      } catch (error) {
        infoLog(error);
        console.log(error);
        console.log("conversion error")
        videoQueueItem.updateStatusCode(id, error.code || videoProcessStatusCode, `${error.message} \n`, true);
        isMachineBusy = false;
        videoConversion.init();
      }
    } else {
      
      isMachineBusy = false;
      infoLog('No pending video for HLS conversion', 'video-conversion');
    }
  },
  operation,
};

module.exports = videoConversion;


