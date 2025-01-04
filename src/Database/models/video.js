const { randomUUID } = require('crypto');
const { all, run, get } = require('../SQLMethod');
const { checkParameters } = require('../../utils');
const { CustomError, CODES } = require('../../error');
const { PATH, URL } = require('../../../config');

const modelsVideo = {
  /**
   *
   * @param {Object} search
   * @param {string} [search.groupBy]
   * @param {string} [search.orderBy]
   * @param {string} [search.limit]
   */
  async getVideos(search) {
    const rest = search || {};

    // TODO: Parameters which will use to retrieve data from video table
    const { groupBy, orderBy, limit, order = 0, offset = 0 } = rest;
    try {
      const query = `SELECT vp.title as title,
       u.full_name,
       v.id AS id,
       v.time_stamp AS video_created_at,
       json_extract('[' || GROUP_CONCAT(JSON_OBJECT('id', t.id,
        'url', CONCAT( ? ,t.url),
        'size', t.size,
        'height', t.height,
        'width', t.width,
        'created_at', t.time_stamp)
    ) || ']', '$') AS thumbnails
     FROM user AS u JOIN video AS v ON u.id = v.user_id 
     LEFT JOIN thumbnail AS t ON v.id = t.video_id 
     LEFT JOIN video_profile as vp ON v.id = vp.video_id
     GROUP BY v.id order by video_created_at ;`;
      const params = [`${URL.SERVER_BASE_URL}/${PATH.MEDIA_API_BASE}/`];
      const result = await all(query, params);
      return {
        videos: result.map((v) => ({ ...v, thumbnails: JSON.parse(v.thumbnails) })),
        ok: true,
        total: result.length,
        message: 'retrieve videos successfully',
      };
    } catch (error) {
      console.log(error);
      return { message: 'something went wrong', error, ok: false };
    }
  },

  /**
   * @param {string} id
   * @param {string} userId
   * @param {string} [originalUrl]
   * @param {string} [HLSUrl]
   * @returns `Object` with message and status in `boolean`
   */
  async insertVideo(id, userId, originalUrl, price,body,pinned,type,video_id) {
    console.log('video insertion start');

    
    const paramType = {
      id: ['string', 'number'],
      originalUrl: ['string', 'number'],
      userId: ['string', 'number'],
      body:['string'],
      type:['string'],
      video_id:['string'],
    };
    checkParameters(paramType, { id, originalUrl, userId, price, pinned, body,type,video_id },CODES.VIDEO_TABLE_PARAMS_ERROR);


    try {
      const sql = `INSERT INTO video ( user_id, original_path, time_stamp,price, pinned, body,type,video_id) values ( ?, ?, ?, ?, ?, ?, ?, ?)`;
      const SQLparams = [ userId, originalUrl, Date.now(), parseFloat(price), parseInt(pinned), body, type, video_id];
      const data = await run(sql, SQLparams);
      return { message: 'successfully inserted', ok: true, ...data };
    } catch (error) {
      throw new CustomError({
        ...error,
        message: error.message,
        name: 'SQL-VIDEO-TABLE-INSERTING-ERROR',
        code: CODES.VIDEO_TABLE_ERROR.code,
      });
    }
  },

  async getVideoById(id) {
    
    const sql = 'select v.id as id, CONCAT(?, hls.hls_url) as url from video as v inner join hls_video as hls on v.id = hls.video_id where v.id = ?';
    const data = await get(sql, [`${URL.SERVER_BASE_URL}/${PATH.MEDIA_API_BASE}/`, id]);
    return { ok: true, message: 'retrieved successfully', data };
  },

  async setVideoProfile({ videoId, title, description, category, tags }) {
    if (!videoId) throw Error('videoId not available');

    const id = randomUUID();
    const timeStamp = Date.now();
    const tag = JSON.stringify(tags);

    const sql = `insert into video_profile (id, video_id, title, description, category, tags, time_stamp) values (?, ?, ?, ?, ?, ?, ?)`;
    await run(sql, [id, videoId, title, description, category, tag, timeStamp]);
    return { id, ok: true };
  },

  async updateVideoProfile(props) {
    const timeStamp = Date.now();
    let columns = '';
    const values = [];
    for (const [key, value] of Object.entries(props)) {
      if (value) {
        columns += `${key} = ?,`;
        values.push(Array.isArray(value) ? JSON.stringify(value) : value);
      }
    }

    values.push(timeStamp);
    values.push(props.id);

    const sql = `UPDATE video_profile SET ${columns} time_stamp = ? where id = ?`;
    await run(sql, values);
    return { ok: true };
  },

  async deleteVideoProfile(id) {
    if (!id) throw Error('id should be available for delete Video profile');
    const sql = `DELETE from video_profile where id = ?`;
    await run(sql, [id]);
    return { ok: true };
  },

  // async insertVideoProgress(percent, video_id) {
  //   console.log('Video progress insertion start: Progress', percent*100, 'ID', video_id);
  
  //   const paramType = {
  //     percent:  ['string', 'number'],
  //     video_id: ['string', 'number'],
  //   };
  
  //   // Check if parameters are valid
  //   checkParameters(paramType, { percent, video_id }, CODES.VIDEO_TABLE_PARAMS_ERROR);
  
  //   try {
  //     const checkQuery = `SELECT 1 FROM video_progress WHERE video_id = ? LIMIT 1`;
  //     const checkParams = [video_id];
  //     const checkResult = await run(checkQuery, checkParams);
  
  //     let result;
  
  //     if (checkResult && checkResult.length > 0) {
  //       const updateQuery = `UPDATE video_progress SET progress_percentage = ?, updated_at = CURRENT_TIMESTAMP, status = ?, WHERE video_id = ?`;
  //       const updateParams = [percent*100, video_id, 'converting'];
  //       result = await run(updateQuery, updateParams);
  //       console.log(`Progress for video_id ${video_id} updated to ${percent}%`);
  //     } else {
  //       // If video_id does not exist, insert a new record
  //       const insertQuery = `INSERT INTO video_progress (progress_percentage, video_id, status) VALUES (?, ?, ?)`;
  //       const insertParams = [percent, video_id, 'converting'];
  //       result = await run(insertQuery, insertParams);
  //       console.log(`Progress for video_id ${video_id} inserted with ${percent}%`);
  //     }
  
  //     return { message: 'Operation successful', ok: true, data: result };
  //   } catch (error) {
  //     throw new CustomError({
  //       ...error,
  //       message: error.message,
  //       name: 'SQL-VIDEO-TABLE-INSERTING-ERROR',
  //       code: CODES.VIDEO_TABLE_ERROR.code,
  //     });
  //   }
  // },

  async insertVideoProgress(percent, video_id) {
    console.log('Video progress insertion start: Progress', percent * 100, 'ID', video_id);
  
    const paramType = {
      percent: ['string', 'number'],
      video_id: ['string', 'number'],
    };
  
    checkParameters(paramType, { percent, video_id }, CODES.VIDEO_TABLE_PARAMS_ERROR);
  
    try {
      const checkQuery = `SELECT video_id FROM video_progress WHERE video_id = ? LIMIT 1`;
      const checkParams = [video_id];
      const checkResult = await get(checkQuery, checkParams);
      console.log('checkResult',checkResult);
      let result;
  
      if (checkResult) {
        console.log('updating')
        const updateQuery = `UPDATE video_progress SET progress_percentage = ?, updated_at = CURRENT_TIMESTAMP, status = ? WHERE video_id = ?`;
        const updateParams = [percent * 100, 'converting', video_id]; 
        result = await run(updateQuery, updateParams);
        console.log(`Progress for video_id ${video_id} updated to ${percent * 100}%`);
      } else {
        console.log('inserting')
        const insertQuery = `INSERT INTO video_progress (progress_percentage, video_id, status) VALUES (?, ?, ?)`;
        const insertParams = [percent * 100, video_id, 'converting'];
        result = await run(insertQuery, insertParams);
        console.log(`Progress for video_id ${video_id} inserted with ${percent * 100}%`);
      }
  
      return { message: 'Operation successful', ok: true, data: result };
    } catch (error) {
      throw new CustomError({
        ...error,
        message: error.message,
        name: 'SQL-VIDEO-TABLE-INSERTING-ERROR',
        code: CODES.VIDEO_TABLE_ERROR.code,
      });
    }
  }
  
  
};

module.exports = modelsVideo;


