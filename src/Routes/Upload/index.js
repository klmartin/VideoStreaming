const multer = require('multer');
const { Router } = require('express');
const controllers = require('../../controller');

const router = Router();
const multerStorage = multer({ storage: multer.memoryStorage() });

router.route('/').post(multerStorage.single('video'), controllers.video.videoUpload);

module.exports = router;
